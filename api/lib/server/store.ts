import { upgradeRoles } from "@/lib/auth/permissions";
import type { PoolClient } from "pg";
import { ValidationError } from "@/lib/data/errors";
import type { DB, Settings } from "@/lib/data/schemas";
import type { DBMeta } from "@/lib/data/schemas";
import { pool } from "./pool";
import { requestContext } from "./context";
import { sqlName, TABLE_NAMES } from "./tables";

/** Everything the server keeps about one business while it is in memory. */
type Loaded = { db: DB; version: number; snapshot: Snapshot };
type Snapshot = { tables: Map<string, Map<string, string>>; settings: string; meta: string };

declare global {
  var __posibleCache: Map<string, Loaded> | undefined;
}
const cache = () => (globalThis.__posibleCache ??= new Map());

const CHUNK = 1500;

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

function takeSnapshot(db: DB): Snapshot {
  const tables = new Map<string, Map<string, string>>();
  for (const t of TABLE_NAMES) {
    const m = new Map<string, string>();
    for (const row of db[t] as { id: string }[]) m.set(row.id, JSON.stringify(row));
    tables.set(t, m);
  }
  return { tables, settings: JSON.stringify(db.settings), meta: JSON.stringify(db.meta) };
}

const UNION = TABLE_NAMES.map((t) => `SELECT '${t}' AS tbl, seq, data FROM ${sqlName(t)} WHERE business_id = $1`).join("\nUNION ALL\n");

/** The business's whole database, read in one consistent snapshot. Cheap when nothing changed since the last read. */
export async function loadBusiness(businessId: string): Promise<Loaded> {
  const current = (await pool().query<{ version: string }>("SELECT version FROM businesses WHERE id = $1", [businessId])).rows[0];
  if (!current) throw new Error("business not found");
  const hit = cache().get(businessId);
  if (hit && hit.version === Number(current.version)) return hit;

  const client = await pool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const biz = (await client.query<{ settings: Settings; meta: DBMeta; version: string }>("SELECT settings, meta, version FROM businesses WHERE id = $1", [businessId])).rows[0];
    const rows = (await client.query<{ tbl: string; data: unknown }>(`SELECT tbl, data FROM (${UNION}) x ORDER BY tbl, seq`, [businessId])).rows;
    await client.query("COMMIT");
    const db = { settings: biz.settings, meta: biz.meta } as DB;
    for (const t of TABLE_NAMES) (db as unknown as Record<string, unknown[]>)[t] = [];
    for (const r of rows) (db as unknown as Record<string, unknown[]>)[r.tbl].push(r.data);
    // Roles saved before the finer permissions existed are upgraded in memory; the next write saves them.
    const snapshot = takeSnapshot(db);
    db.roles = upgradeRoles(db.roles);
    const loaded: Loaded = { db: deepFreeze(db), version: Number(biz.version), snapshot };
    cache().set(businessId, loaded);
    return loaded;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export type Diff = { upserts: Map<string, { id: string; data: unknown }[]>; deletes: Map<string, string[]>; changed: number };

function diff(before: Snapshot, db: DB): Diff {
  const upserts = new Map<string, { id: string; data: unknown }[]>();
  const deletes = new Map<string, string[]>();
  let changed = 0;
  for (const t of TABLE_NAMES) {
    const old = before.tables.get(t) ?? new Map();
    const seen = new Set<string>();
    const up: { id: string; data: unknown }[] = [];
    for (const row of db[t] as { id: string }[]) {
      if (seen.has(row.id)) throw new Error(`duplicate id ${row.id} in ${t}`);
      seen.add(row.id);
      if (old.get(row.id) !== JSON.stringify(row)) up.push({ id: row.id, data: row });
    }
    const del = [...old.keys()].filter((id) => !seen.has(id));
    if (up.length) upserts.set(t, up);
    if (del.length) deletes.set(t, del);
    changed += up.length + del.length;
  }
  return { upserts, deletes, changed };
}

async function applyDiff(client: PoolClient, businessId: string, d: Diff): Promise<void> {
  for (const [t, ids] of d.deletes) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      await client.query(`DELETE FROM ${sqlName(t)} WHERE business_id = $1 AND id = ANY($2::text[])`, [businessId, ids.slice(i, i + CHUNK)]);
    }
  }
  for (const [t, rows] of d.upserts) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await client.query(
        `INSERT INTO ${sqlName(t)} (business_id, id, data)
         SELECT $1, x.id, x.data FROM jsonb_to_recordset($2::jsonb) AS x(id text, data jsonb)
         ON CONFLICT (business_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [businessId, JSON.stringify(rows.slice(i, i + CHUNK))],
      );
    }
  }
  // Keep the global sign-in index in step with the users table.
  const removed = d.deletes.get("users") ?? [];
  const upserted = d.upserts.get("users") ?? [];
  if (removed.length || upserted.length) {
    await client.query("DELETE FROM logins WHERE business_id = $1 AND user_id = ANY($2::text[])", [businessId, [...removed, ...upserted.map((u) => u.id)]]);
    if (upserted.length) {
      const res = await client.query(
        `INSERT INTO logins (username, business_id, user_id)
         SELECT lower(x.username), $1, x.id FROM jsonb_to_recordset($2::jsonb) AS x(id text, username text)
         ON CONFLICT (username) DO NOTHING`,
        [businessId, JSON.stringify(upserted.map((u) => ({ id: u.id, username: (u.data as { username: string }).username })))],
      );
      if ((res.rowCount ?? 0) < upserted.length) throw new ValidationError({ username: "duplicate" });
    }
  }
}

/** Stores a brand-new business: its row plus every record, in one transaction. */
export async function insertBusiness(id: string, db: DB): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO businesses (id, name, settings, meta, version) VALUES ($1, $2, $3, $4, 1)", [id, db.settings.business.name, db.settings, db.meta]);
    await applyDiff(client, id, diff({ tables: new Map(), settings: "", meta: "" }, db));
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

type Outcome<T> = { result: T; wrote: boolean; changedRows: number };

/**
 * Runs `fn` against the business's data as `userId`. Reads are lock-free; if the function changed anything, the
 * changes are saved in one transaction guarded by the business's version, and the whole call is retried if someone
 * else saved first. Nothing is written when `fn` throws.
 */
export async function runInBusiness<T>(businessId: string, userId: string | null, fn: () => Promise<T>): Promise<Outcome<T>> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const loaded = await loadBusiness(businessId);
    const ctx = { db: loaded.db, userId, dirty: false };
    const result = await requestContext.run(ctx, fn);
    if (!ctx.dirty) return { result, wrote: false, changedRows: 0 };

    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const row = (await client.query<{ version: string }>("SELECT version FROM businesses WHERE id = $1 FOR UPDATE", [businessId])).rows[0];
      if (!row || Number(row.version) !== loaded.version) {
        await client.query("ROLLBACK");
        cache().delete(businessId);
        continue; // someone saved first: run again on the fresh data
      }
      const d = diff(loaded.snapshot, ctx.db);
      await applyDiff(client, businessId, d);
      const settings = JSON.stringify(ctx.db.settings);
      const meta = JSON.stringify(ctx.db.meta);
      const next = loaded.version + 1;
      await client.query("UPDATE businesses SET settings = $2, meta = $3, name = $4, version = $5 WHERE id = $1", [businessId, settings, meta, ctx.db.settings.business.name, next]);
      await client.query("COMMIT");
      cache().set(businessId, { db: deepFreeze(ctx.db), version: next, snapshot: takeSnapshot(ctx.db) });
      return { result, wrote: true, changedRows: d.changed };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      cache().delete(businessId);
      throw e;
    } finally {
      client.release();
    }
  }
  throw new Error("The shop is busy. Try again.");
}

export function forgetBusiness(id: string): void {
  cache().delete(id);
}
