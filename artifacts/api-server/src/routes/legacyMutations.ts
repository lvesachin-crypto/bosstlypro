import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router(); router.use(requireAuth);
const schema = z.object({ table: z.enum(["user_provider_accounts", "user_services", "user_bundles", "user_bundle_items", "user_bundle_item_providers"]), action: z.enum(["insert", "update", "delete", "upsert"]), values: z.any().optional(), filters: z.array(z.object({ column: z.string(), value: z.any() })).default([]) });
const columns: Record<string, string[]> = {
  user_provider_accounts: [], user_services: ["name", "category", "type", "rate", "min_quantity", "max_quantity", "refill", "cancel_allowed", "is_active"],
  user_bundles: ["name", "description", "platform"], user_bundle_items: ["engagement_type", "quantity"],
  user_bundle_item_providers: ["enabled", "provider_service_id", "priority"],
};
async function user(req: AuthenticatedRequest): Promise<string> {
  const id = (await clerkClient.users.getUser(req.userId)).externalId;
  if (!id) throw new Error("Your account is not linked to legacy data."); return id;
}
function uuidFilter(filters: { column: string; value?: unknown }[]): string | undefined { const id = filters.find((f) => f.column === "id")?.value; return typeof id === "string" ? id : undefined; }
async function owns(client: typeof pool, table: string, id: string, uid: string): Promise<boolean> {
  const q = table === "user_bundle_items"
    ? "SELECT 1 FROM lovable_legacy.user_bundle_items WHERE id=$1::uuid AND user_id=$2::uuid"
    : table === "user_bundle_item_providers"
      ? "SELECT 1 FROM lovable_legacy.user_bundle_item_providers WHERE id=$1::uuid AND user_id=$2::uuid"
      : `SELECT 1 FROM lovable_legacy.${table} WHERE id=$1::uuid AND user_id=$2::uuid`;
  return !!(await client.query(q, [id, uid])).rows[0];
}
router.post("/legacy/mutate", async (req, res): Promise<void> => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid mutation" }); return; }
  const { table, action, filters } = parsed.data;
  try {
    const uid = await user(req as AuthenticatedRequest); const values = parsed.data.values ?? {};
    const allowed = columns[table]; const data = Object.fromEntries(Object.entries(values).filter(([k]) => allowed.includes(k)));
    const id = uuidFilter(filters);
    if (table === "user_provider_accounts") {
      if (action !== "delete" || !id || !(await owns(pool, table, id, uid))) { res.status(403).json({ error: "Provider accounts must be created and changed through the provider endpoint." }); return; }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM lovable_legacy.user_bundle_item_providers WHERE user_provider_account_id=$1::uuid AND user_id=$2::uuid", [id, uid]);
        await client.query("DELETE FROM lovable_legacy.user_services WHERE user_provider_account_id=$1::uuid AND user_id=$2::uuid", [id, uid]);
        await client.query("DELETE FROM lovable_legacy.user_provider_accounts WHERE id=$1::uuid AND user_id=$2::uuid", [id, uid]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
      res.json({ data: [], error: null }); return;
    }
    if ((action === "update" || action === "delete") && (!id || !(await owns(pool, table, id, uid)))) { res.status(404).json({ error: "Record not found" }); return; }
    if (action === "insert") {
      if (table === "user_services") {
        const account = typeof values.user_provider_account_id === "string" ? values.user_provider_account_id : "";
        const serviceId = typeof values.provider_service_id === "string" ? values.provider_service_id.trim() : "";
        if (!account || !serviceId || !(await owns(pool, "user_provider_accounts", account, uid)) || typeof data.name !== "string") throw new Error("An owned provider, service ID, and service name are required.");
        const r = await pool.query(`INSERT INTO lovable_legacy.user_services
          (user_id,user_provider_account_id,provider_service_id,name,category,type,rate,min_quantity,max_quantity,refill,cancel_allowed,is_active)
          VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [uid,account,serviceId,data.name,data.category ?? null,data.type ?? null,data.rate ?? 0,data.min_quantity ?? 1,data.max_quantity ?? 1000000,data.refill ?? false,data.cancel_allowed ?? false,data.is_active ?? true]);
        res.status(201).json({ data: r.rows, error: null }); return;
      }
      if (table === "user_bundles") {
        if (!data.name || typeof data.name !== "string") throw new Error("Bundle name is required.");
        const r = await pool.query("INSERT INTO lovable_legacy.user_bundles (user_id,name,description,platform) VALUES ($1::uuid,$2,$3,$4) RETURNING *", [uid, data.name.trim(), data.description ?? null, data.platform ?? "instagram"]); res.status(201).json({ data: r.rows, error: null }); return;
      }
      if (table === "user_bundle_items") {
        const bundle = typeof values.user_bundle_id === "string" ? values.user_bundle_id : "";
        if (!bundle || !(await owns(pool, "user_bundles", bundle, uid)) || !data.engagement_type) throw new Error("A valid bundle and engagement type are required.");
        const r = await pool.query("INSERT INTO lovable_legacy.user_bundle_items (user_id,user_bundle_id,engagement_type,quantity) VALUES ($1::uuid,$2::uuid,$3,$4) RETURNING *", [uid,bundle,data.engagement_type,data.quantity ?? 100]); res.status(201).json({ data:r.rows,error:null }); return;
      }
      if (table === "user_bundle_item_providers") {
        const item = typeof values.user_bundle_item_id === "string" ? values.user_bundle_item_id : ""; const account = typeof values.user_provider_account_id === "string" ? values.user_provider_account_id : "";
        if (!item || !account || !(await owns(pool,"user_bundle_items",item,uid)) || !(await owns(pool,"user_provider_accounts",account,uid))) throw new Error("A valid owned bundle item and provider account are required.");
        const r = await pool.query("INSERT INTO lovable_legacy.user_bundle_item_providers (user_id,user_bundle_item_id,user_provider_account_id,enabled,provider_service_id,priority) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6) RETURNING *",[uid,item,account,data.enabled ?? false,data.provider_service_id ?? null,data.priority ?? 1]); res.status(201).json({data:r.rows,error:null}); return;
      }
      res.status(403).json({ error: "This service cannot be created locally." }); return;
    }
    if (action === "delete") { await pool.query(`DELETE FROM lovable_legacy.${table} WHERE id=$1::uuid AND user_id=$2::uuid`,[id,uid]); res.json({data:[],error:null}); return; }
    if (action === "update") {
      const pairs = Object.keys(data); if (!pairs.length) { res.status(400).json({error:"No writable fields supplied."}); return; }
      const params = [...Object.values(data), id, uid]; const sets = pairs.map((k,i) => `${k}=$${i+1}`).join(",");
      const r = await pool.query(`UPDATE lovable_legacy.${table} SET ${sets},updated_at=now() WHERE id=$${pairs.length+1}::uuid AND user_id=$${pairs.length+2}::uuid RETURNING *`,params);
      res.json({data:r.rows,error:null}); return;
    }
    res.status(400).json({error:"Unsupported mutation."});
  } catch (error) { req.log.warn({err:error instanceof Error ? error.message : "mutation failed"},"Legacy mutation failed"); res.status(400).json({error:error instanceof Error ? error.message : "Legacy mutation failed"}); }
});
export default router;