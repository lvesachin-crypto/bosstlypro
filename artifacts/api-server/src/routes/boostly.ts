import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  ordersTable,
  profilesTable,
  servicesTable,
  supportTicketsTable,
  transactionsTable,
  userRolesTable,
  walletsTable,
} from "@workspace/db";
import { z } from "zod";
import { clerkClient } from "@clerk/express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

function userId(req: AuthenticatedRequest): string {
  return req.userId;
}

/** JIT provisioning replaces the former Supabase auth.users trigger. */
async function ensureAccount(id: string): Promise<void> {
  const clerkUser = await clerkClient.users.getUser(id);
  const email =
    clerkUser.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${id}@clerk.local`;
  await db.transaction(async (tx) => {
    const [profile] = await tx.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.userId, id)).limit(1);
    if (!profile) {
      await tx.insert(profilesTable).values({ userId: id, email, fullName: clerkUser.fullName }).onConflictDoNothing();
      await tx.insert(walletsTable).values({ userId: id }).onConflictDoNothing();
      await tx.insert(userRolesTable).values({ userId: id }).onConflictDoNothing();
    }
  });
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const id = userId(req as AuthenticatedRequest);
  await ensureAccount(id);
  const [[profile], [wallet], [role], recentOrders, services] = await Promise.all([
    db.select().from(profilesTable).where(eq(profilesTable.userId, id)).limit(1),
    db.select().from(walletsTable).where(eq(walletsTable.userId, id)).limit(1),
    db.select().from(userRolesTable).where(eq(userRolesTable.userId, id)).limit(1),
    db.select().from(ordersTable).where(eq(ordersTable.userId, id)).orderBy(desc(ordersTable.createdAt)).limit(5),
    db.select({ count: servicesTable.id }).from(servicesTable).where(eq(servicesTable.isActive, true)),
  ]);
  res.json({ profile, wallet, role: role?.role ?? "user", recentOrders, activeServices: services.length });
});

router.get("/admin/status", async (req, res): Promise<void> => {
  const id = userId(req as AuthenticatedRequest);
  await ensureAccount(id);
  const [role] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, id)).limit(1);
  res.json({ isAdmin: role?.role === "admin" });
});

router.get("/services", async (_req, res): Promise<void> => {
  const services = await db.select().from(servicesTable).where(eq(servicesTable.isActive, true)).orderBy(servicesTable.category, servicesTable.name);
  res.json(services);
});

router.get("/orders", async (req, res): Promise<void> => {
  const id = userId(req as AuthenticatedRequest);
  await ensureAccount(id);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, id)).orderBy(desc(ordersTable.createdAt));
  res.json(orders);
});

router.post("/orders", (_req, res): void => {
  res.status(503).json({
    error: "Order placement is paused until a verified fulfillment provider is configured. No wallet funds were charged.",
  });
});

router.get("/wallet", async (req, res): Promise<void> => {
  const id = userId(req as AuthenticatedRequest);
  await ensureAccount(id);
  const [[wallet], transactions] = await Promise.all([
    db.select().from(walletsTable).where(eq(walletsTable.userId, id)).limit(1),
    db.select().from(transactionsTable).where(eq(transactionsTable.userId, id)).orderBy(desc(transactionsTable.createdAt)).limit(100),
  ]);
  res.json({ wallet, transactions });
});

router.post("/wallet/deposits", async (_req, res): Promise<void> => {
  // Payment gateways are intentionally not emulated. Credentials must be
  // configured along with a verified webhook implementation before enabling one.
  res.status(501).json({ error: "No payment provider is configured. Wallet deposits are unavailable." });
});

router.get("/support/tickets", async (req, res): Promise<void> => {
  const tickets = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.userId, userId(req as AuthenticatedRequest))).orderBy(desc(supportTicketsTable.updatedAt));
  res.json(tickets);
});

const createTicket = z.object({ subject: z.string().trim().min(1).max(200), message: z.string().trim().min(1).max(10000), category: z.string().max(80).optional(), priority: z.enum(["low", "medium", "high"]).optional(), orderId: z.string().uuid().optional() });
router.post("/support/tickets", async (req, res): Promise<void> => {
  const parsed = createTicket.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid ticket" });
    return;
  }
  const [ticket] = await db.insert(supportTicketsTable).values({ userId: userId(req as AuthenticatedRequest), ...parsed.data }).returning();
  res.status(201).json(ticket);
});

router.get("/settings", async (req, res): Promise<void> => {
  const id = userId(req as AuthenticatedRequest);
  await ensureAccount(id);
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, id)).limit(1);
  res.json(profile);
});

const updateSettings = z.object({ fullName: z.string().trim().max(200).nullable().optional(), currency: z.string().trim().length(3).optional() });
router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = updateSettings.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" });
    return;
  }
  const id = userId(req as AuthenticatedRequest);
  await ensureAccount(id);
  const [profile] = await db.update(profilesTable).set(parsed.data).where(eq(profilesTable.userId, id)).returning();
  res.json(profile);
});

export default router;