import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function positivePoolSize(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(50, Math.floor(parsed));
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: positivePoolSize(process.env.DB_POOL_MAX, 15),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  maxUses: 7_500,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
