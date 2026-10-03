import { Pool } from "pg";
import { MIGRATIONS } from "./schema";

declare global {
  var __posiblePool: Pool | undefined;
  var __posibleReady: Promise<void> | undefined;
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at a Postgres database.");
  return url;
}

/** One pool per server process, kept across hot reloads in development. */
export function pool(): Pool {
  globalThis.__posiblePool ??= new Pool({ connectionString: databaseUrl(), max: Number(process.env.PG_POOL_MAX ?? 10) });
  return globalThis.__posiblePool;
}

/** Applies pending migrations (once per process, serialised across processes by an advisory lock). */
export async function migrate(): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (id int PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await client.query<{ id: number }>("SELECT id FROM schema_migrations")).rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (id, name) VALUES ($1, $2)", [m.id, m.name]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    client.release();
  }
}

/** Resolves once the schema is current and, if asked to, the demo business exists. */
export function ready(): Promise<void> {
  globalThis.__posibleReady ??= (async () => {
    await migrate();
    const { seedDemoIfEmpty } = await import("./tenants");
    await seedDemoIfEmpty();
  })().catch((e) => {
    globalThis.__posibleReady = undefined; // let the next request try again
    throw e;
  });
  return globalThis.__posibleReady;
}
