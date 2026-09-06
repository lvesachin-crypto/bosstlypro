import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

// Kept intentionally small: this is a compatibility endpoint, not a general
// database-function proxy.
const requestSchema = z.object({
  name: z.literal("get_admin_users_summary"),
}).strict();

async function requireLegacyAdmin(req: AuthenticatedRequest): Promise<void> {
  const clerkUser = await clerkClient.users.getUser(req.userId);
  const legacyId = clerkUser.externalId;
  if (!legacyId) throw new Error("Your account is not linked to legacy data.");

  const result = await pool.query<{ is_admin: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM lovable_legacy.user_roles
        WHERE user_id = $1::uuid
          AND role::text = 'admin'
     ) AS is_admin`,
    [legacyId],
  );
  if (!result.rows[0]?.is_admin) {
    const error = new Error("Administrator access is required.");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}

router.post("/legacy/rpc", async (req, res): Promise<void> => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: "This legacy RPC is unavailable through the compatibility API." });
    return;
  }

  try {
    await requireLegacyAdmin(req as AuthenticatedRequest);
    // Each related relation is read in an independent lateral subquery. This
    // preserves profiles as the base relation and prevents aggregate joins
    // from multiplying user rows.
    const result = await pool.query<Record<string, unknown>>(
      `SELECT
         p.id,
         p.user_id,
         p.email,
         p.full_name,
         p.currency,
         p.created_at,
         COALESCE(p.is_banned, false) AS is_banned,
         p.banned_at,
         p.banned_reason,
         COALESCE(wallet.balance, 0)::double precision AS balance,
         COALESCE(wallet.total_deposited, 0)::double precision AS total_deposited,
         COALESCE(wallet.total_spent, 0)::double precision AS total_spent,
         COALESCE(user_role.role, 'user') AS role,
         COALESCE(subscription.plan_type, 'none') AS plan_type,
         COALESCE(subscription.status, 'inactive') AS subscription_status,
         subscription.expires_at AS subscription_expires,
         COALESCE(single_orders.active_count, 0)::integer AS active_single_orders,
         COALESCE(single_orders.paused_count, 0)::integer AS paused_single_orders,
         COALESCE(engagement_orders.active_count, 0)::integer AS active_engagement_orders,
         COALESCE(engagement_orders.paused_count, 0)::integer AS paused_engagement_orders
       FROM lovable_legacy.profiles p
       LEFT JOIN LATERAL (
         SELECT w.balance, w.total_deposited, w.total_spent
           FROM lovable_legacy.wallets w
          WHERE w.user_id = p.user_id
          LIMIT 1
       ) wallet ON true
       LEFT JOIN LATERAL (
         SELECT ur.role::text AS role
           FROM lovable_legacy.user_roles ur
          WHERE ur.user_id = p.user_id
          ORDER BY ur.created_at DESC
          LIMIT 1
       ) user_role ON true
       LEFT JOIN LATERAL (
         SELECT s.plan_type, s.status, s.expires_at
           FROM lovable_legacy.subscriptions s
          WHERE s.user_id = p.user_id
          ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC NULLS LAST
          LIMIT 1
       ) subscription ON true
       LEFT JOIN LATERAL (
         SELECT
           count(*) FILTER (WHERE o.status IN ('pending', 'processing'))::integer AS active_count,
           count(*) FILTER (WHERE o.status = 'paused')::integer AS paused_count
           FROM lovable_legacy.orders o
          WHERE o.user_id = p.user_id
       ) single_orders ON true
       LEFT JOIN LATERAL (
         SELECT
           count(*) FILTER (WHERE eo.status IN ('pending', 'processing'))::integer AS active_count,
           count(*) FILTER (WHERE eo.status = 'paused')::integer AS paused_count
           FROM lovable_legacy.engagement_orders eo
          WHERE eo.user_id = p.user_id
       ) engagement_orders ON true
       ORDER BY p.created_at DESC`,
    );
    res.json({ data: result.rows, error: null });
  } catch (error) {
    const status = (error as Error & { status?: number }).status
      ?? (error instanceof Error && error.message.includes("not linked") ? 401 : 500);
    if (status >= 500) console.warn("[legacy-rpc] get_admin_users_summary failed");
    res.status(status).json({
      data: null,
      error: error instanceof Error ? error.message : "Legacy RPC failed",
    });
  }
});

export default router;