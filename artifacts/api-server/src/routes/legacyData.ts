import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

// This is deliberately a closed compatibility surface, not a SQL proxy.
const tables = new Set([
  "admin_audit_log", "avatars", "bundle_items", "chat_conversations", "chat_messages",
  "engagement_bundles", "engagement_order_items", "engagement_orders", "organic_run_schedule",
  "orders", "oxapay_deposits", "oxapay_webhook_events", "platform_settings", "popup_ads",
  "profiles", "provider_accounts", "providers", "service_provider_mapping", "services",
  "subscription_plans", "subscription_requests", "subscriptions", "support_tickets",
  "transactions", "user_bundle_item_providers", "user_bundle_items", "user_bundles",
  "user_provider_accounts", "user_provider_accounts_safe", "user_roles", "user_services", "wallets",
]);
const publicTables = new Set(["subscription_plans", "services", "popup_ads"]);
// These tables back end-user screens and must always remain tenant-scoped.
// Administrative cross-user access belongs in dedicated audited admin routes,
// never in this generic compatibility reader.
const alwaysOwnerScopedTables = new Set([
  "user_provider_accounts",
  "user_provider_accounts_safe",
  "user_services",
  "user_bundles",
  "user_bundle_items",
  "user_bundle_item_providers",
]);
const identifier = /^[a-z_][a-z0-9_]*$/;
const forbiddenFields = new Set(["api_key", "encrypted_api_key", "api_key_encrypted", "api_key_ciphertext"]);

const requestSchema = z.object({
  table: z.string(),
  filters: z.array(z.object({
    operator: z.enum(["eq", "neq", "in", "is"]),
    column: z.string(),
    value: z.unknown(),
  })).max(25).default([]),
  order: z.object({ column: z.string(), ascending: z.boolean().default(true) }).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  range: z.object({ from: z.number().int().min(0), to: z.number().int().min(0).max(999) }).optional(),
  select: z.string().max(4000).optional(),
});

function quote(name: string): string {
  if (!identifier.test(name)) throw new Error("Invalid legacy query column");
  return `"${name}"`;
}

async function identity(req: AuthenticatedRequest) {
  const cached = identityCache.get(req.userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = (async () => {
    const user = await clerkClient.users.getUser(req.userId);
    const legacyId = user.externalId;
    if (!legacyId) throw new Error("Your account is not linked to legacy data.");
    const role = await pool.query<{ role: string }>(
      "SELECT role::text AS role FROM lovable_legacy.user_roles WHERE user_id = $1::uuid LIMIT 1",
      [legacyId],
    );
    return { legacyId, isAdmin: role.rows[0]?.role === "admin" };
  })().catch((error) => {
    identityCache.delete(req.userId);
    throw error;
  });
  identityCache.set(req.userId, { expiresAt: Date.now() + 60_000, value });
  return value;
}

const identityCache = new Map<string, {
  expiresAt: number;
  value: Promise<{ legacyId: string; isAdmin: boolean }>;
}>();

function sanitize(row: Record<string, unknown>): Record<string, unknown> {
  for (const field of Object.keys(row)) {
    if (forbiddenFields.has(field) || field.includes("api_key") || field.includes("secret")) delete row[field];
  }
  return row;
}

async function hydrate(table: string, rows: Record<string, unknown>[], select = ""): Promise<void> {
  if (!rows.length) return;
  if (table === "user_services" && select.includes("provider:")) {
    const providerIds = [...new Set(rows.map((row) => String(row.user_provider_account_id)).filter(Boolean))];
    const providers = providerIds.length
      ? await pool.query<Record<string, unknown>>("SELECT id, name FROM lovable_legacy.user_provider_accounts WHERE id = ANY($1::uuid[])", [providerIds])
      : { rows: [] as Record<string, unknown>[] };
    const byId = new Map(providers.rows.map((provider) => [String(provider.id), sanitize(provider)]));
    for (const row of rows) row.provider = byId.get(String(row.user_provider_account_id)) ?? null;
  }
  if (table === "engagement_orders" && select.includes("engagement_order_items")) {
    const ids = rows.map((row) => row.id);
    const items = await pool.query<Record<string, unknown>>(
      "SELECT * FROM lovable_legacy.engagement_order_items WHERE engagement_order_id = ANY($1::uuid[])",
      [ids],
    );
    const itemIds = items.rows.map((item) => item.id);
    const runs = itemIds.length && select.includes("organic_run_schedule")
      ? await pool.query<Record<string, unknown>>("SELECT * FROM lovable_legacy.organic_run_schedule WHERE engagement_order_item_id = ANY($1::uuid[])", [itemIds])
      : { rows: [] as Record<string, unknown>[] };
    const runsByItem = new Map<string, Record<string, unknown>[]>();
    for (const run of runs.rows) {
      const key = String(run.engagement_order_item_id);
      runsByItem.set(key, [...(runsByItem.get(key) ?? []), sanitize(run)]);
    }
    const byOrder = new Map<string, Record<string, unknown>[]>();
    for (const item of items.rows) {
      const clean = sanitize(item);
      if (select.includes("organic_run_schedule")) clean.runs = runsByItem.get(String(item.id)) ?? [];
      const key = String(item.engagement_order_id);
      byOrder.set(key, [...(byOrder.get(key) ?? []), clean]);
    }
    for (const row of rows) row.items = byOrder.get(String(row.id)) ?? [];
  }
  if (table === "user_bundles" && select.includes("user_bundle_items")) {
    const bundleIds = rows.map((row) => row.id);
    const ownerIds = [...new Set(rows.map((row) => row.user_id))];
    const items = await pool.query<Record<string, unknown>>(
      "SELECT * FROM lovable_legacy.user_bundle_items WHERE user_bundle_id = ANY($1::uuid[]) AND user_id = ANY($2::uuid[])",
      [bundleIds, ownerIds],
    );
    const itemIds = items.rows.map((item) => item.id);
    const mappings = itemIds.length && select.includes("user_bundle_item_providers")
      ? await pool.query<Record<string, unknown>>(
        "SELECT * FROM lovable_legacy.user_bundle_item_providers WHERE user_bundle_item_id = ANY($1::uuid[]) AND user_id = ANY($2::uuid[])",
        [itemIds, ownerIds],
      )
      : { rows: [] as Record<string, unknown>[] };
    const mappingsByItem = new Map<string, Record<string, unknown>[]>();
    for (const mapping of mappings.rows) {
      const key = String(mapping.user_bundle_item_id);
      mappingsByItem.set(key, [...(mappingsByItem.get(key) ?? []), sanitize(mapping)]);
    }
    const byBundle = new Map<string, Record<string, unknown>[]>();
    for (const item of items.rows) {
      const clean = sanitize(item);
      if (select.includes("user_bundle_item_providers")) {
        clean.user_bundle_item_providers = mappingsByItem.get(String(clean.id)) ?? [];
      }
      const key = String(clean.user_bundle_id);
      byBundle.set(key, [...(byBundle.get(key) ?? []), clean]);
    }
    for (const row of rows) row.user_bundle_items = byBundle.get(String(row.id)) ?? [];
  }
}

router.post("/legacy/query", async (req, res): Promise<void> => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success || !tables.has(parsed.data?.table ?? "")) {
    res.status(400).json({ error: "This legacy table is unavailable through the compatibility API." });
    return;
  }
  try {
    const query = parsed.data;
    const user = await identity(req as AuthenticatedRequest);
    // Restored pages still compare user_id with the active auth user ID.
    // Translate Clerk IDs to the linked UUID used by the imported database.
    query.filters = query.filters.map((filter) =>
      filter.column === "user_id" && typeof filter.value === "string" && filter.value.startsWith("user_")
        ? { ...filter, value: user.legacyId }
        : filter,
    );
    if (query.table === "popup_ads") {
      res.json({ data: [], error: null });
      return;
    }
    const scoped = !publicTables.has(query.table);
    const mustScope = scoped && (!user.isAdmin || alwaysOwnerScopedTables.has(query.table));
    const ownerlessChild = query.table === "engagement_order_items" || query.table === "organic_run_schedule";
    if (mustScope) {
      // All non-public legacy tables are private. The mandatory owner predicate
      // cannot be widened or overridden by a caller-supplied user_id filter.
      query.filters = query.filters.filter((filter) => filter.column !== "user_id");
      if (!ownerlessChild) query.filters.push({ operator: "eq", column: "user_id", value: user.legacyId });
    }
    const values: unknown[] = [];
    const conditions = query.filters.map((filter) => {
      const column = `t.${quote(filter.column)}`;
      if (filter.operator === "is") return filter.value === null ? `${column} IS NULL` : `${column} IS NOT NULL`;
      values.push(filter.value);
      const parameter = `$${values.length}`;
      if (filter.operator === "in") return `${column} = ANY(${parameter})`;
      return `${column} ${filter.operator === "eq" ? "=" : "<>"} ${parameter}`;
    });
    let sql = `SELECT t.* FROM lovable_legacy.${quote(query.table)} t`;
    if (mustScope && ownerlessChild) {
      values.push(user.legacyId);
      const ownerParameter = `$${values.length}`;
      conditions.push(query.table === "engagement_order_items"
        ? `EXISTS (SELECT 1 FROM lovable_legacy.engagement_orders owned_order WHERE owned_order.id=t.engagement_order_id AND owned_order.user_id=${ownerParameter}::uuid)`
        : `EXISTS (SELECT 1 FROM lovable_legacy.engagement_order_items owned_item JOIN lovable_legacy.engagement_orders owned_order ON owned_order.id=owned_item.engagement_order_id WHERE owned_item.id=t.engagement_order_item_id AND owned_order.user_id=${ownerParameter}::uuid)`);
    }
    if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
    if (query.order) sql += ` ORDER BY t.${quote(query.order.column)} ${query.order.ascending ? "ASC" : "DESC"}`;
    const take = query.range ? query.range.to - query.range.from + 1 : (query.limit ?? 200);
    sql += ` LIMIT ${take}`;
    if (query.range) sql += ` OFFSET ${query.range.from}`;
    const result = await pool.query<Record<string, unknown>>(sql, values);
    const rows = result.rows.map(sanitize);
    await hydrate(query.table, rows, query.select);
    res.json({ data: rows, error: null });
  } catch (error) {
    console.warn("[legacy-query]", parsed.data.table, error instanceof Error ? error.message : "Legacy query failed");
    res.status(400).json({ data: null, error: error instanceof Error ? error.message : "Legacy query failed" });
  }
});

export default router;