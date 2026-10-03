import { pool } from "./pool";

/**
 * Failed-attempt counters kept in Postgres, so a limit holds across restarts and across every API instance.
 * One row per key: the count inside the current window. Both calls are single statements, so they are atomic.
 */

/** True once `key` has failed `limit` times inside the window. */
export async function throttled(key: string, limit: number, windowMs: number): Promise<boolean> {
  const r = await pool().query("SELECT 1 FROM rate_limits WHERE key = $1 AND hits >= $2 AND window_start > now() - $3 * interval '1 millisecond'", [key, limit, windowMs]);
  return (r.rowCount ?? 0) > 0;
}

/** Counts one failure; the first failure after the window has passed starts a fresh window. */
export async function recordFail(key: string, windowMs: number): Promise<void> {
  await pool().query(
    `INSERT INTO rate_limits (key, hits, window_start) VALUES ($1, 1, now())
     ON CONFLICT (key) DO UPDATE SET
       hits = CASE WHEN rate_limits.window_start <= now() - $2 * interval '1 millisecond' THEN 1 ELSE rate_limits.hits + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= now() - $2 * interval '1 millisecond' THEN now() ELSE rate_limits.window_start END`,
    [key, windowMs]);
  void pool().query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'").catch(() => {});
}

export async function clearFails(...keys: string[]): Promise<void> {
  await pool().query("DELETE FROM rate_limits WHERE key = ANY($1)", [keys]);
}
