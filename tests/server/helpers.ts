import { Pool } from "pg";

const URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/pos_sible_test";
process.env.DATABASE_URL = URL;
process.env.POS_SEED_DEMO = "false"; // tests create their own businesses

/** True when a Postgres server is reachable; the server tests are skipped (not failed) without one. */
export async function postgresAvailable(): Promise<boolean> {
  const p = new Pool({ connectionString: URL, connectionTimeoutMillis: 1500 });
  try {
    await p.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await p.end().catch(() => {});
  }
}
