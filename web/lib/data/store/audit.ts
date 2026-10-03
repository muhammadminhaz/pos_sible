import type { DB } from "@/lib/data/schemas";

type Row = Record<string, unknown> & { id?: unknown };

const AUDIT = new Set(["updatedAt", "updatedBy"]);

/** Structural equality for JSON-shaped values. `skip` names top-level keys that don't count as a change. */
function same(a: unknown, b: unknown, skip?: Set<string>): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const y = b as unknown[];
    return a.length === y.length && a.every((v, i) => same(v, y[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const kx = Object.keys(x).filter((k) => !skip?.has(k) && x[k] !== undefined);
  const ky = Object.keys(y).filter((k) => !skip?.has(k) && y[k] !== undefined);
  return kx.length === ky.length && kx.every((k) => same(x[k], y[k]));
}

/**
 * Who changed what, when. Called by `commit()` with the database before and after a change: a row that is new gets
 * its creator and a "last updated" stamp, a row that differs from before gets a fresh "last updated" stamp. Doing
 * it here, in one place, means no service can forget — and nothing can forge another person's name.
 *
 * Rows are matched by id. Only arrays of `{ id }` objects are looked at, so settings and counters are left alone.
 */
export function stampChanges(before: DB, after: DB, by: string | null, at: string): void {
  const prev = before as unknown as Record<string, unknown>;
  for (const [table, rows] of Object.entries(after as unknown as Record<string, unknown>)) {
    if (!Array.isArray(rows) || table === "backups") continue;
    const old = prev[table];
    const index = new Map<unknown, Row>();
    if (Array.isArray(old)) for (const r of old as Row[]) if (r && typeof r === "object") index.set(r.id, r);
    for (const row of rows as Row[]) {
      if (!row || typeof row !== "object" || typeof row.id !== "string") continue;
      const was = index.get(row.id);
      if (!was) {
        row.createdBy ??= by;
        row.updatedAt = at;
        row.updatedBy = by;
      } else if (!same(was, row, AUDIT)) {
        row.updatedAt = at;
        row.updatedBy = by;
      }
    }
  }
}
