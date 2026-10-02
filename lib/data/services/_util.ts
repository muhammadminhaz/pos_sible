import { nextRef } from "@/lib/domain/refs";
import { EditWindowExpiredError } from "@/lib/data/errors";
import type { DB } from "@/lib/data/schemas";

/** Simulated network latency (0–150ms). Instant outside the browser so tests stay fast. */
export const delay = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, typeof window === "undefined" ? 0 : Math.random() * 150));

export type Sort = { id: string; desc: boolean };
export type ListQuery = { search?: string; page?: number; pageSize?: number; sort?: Sort };
export type ListResult<T> = { rows: T[]; total: number };

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortRows<T>(rows: T[], sort?: Sort): T[] {
  if (!sort) return rows;
  const dir = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => dir * compare((a as Record<string, unknown>)[sort.id], (b as Record<string, unknown>)[sort.id]));
}

/** Sort (if asked), then slice. `page` is 0-based. */
export function paginate<T>(rows: T[], q: ListQuery): ListResult<T> {
  const sorted = sortRows(rows, q.sort);
  const pageSize = q.pageSize ?? 25;
  const page = q.page ?? 0;
  return { rows: pageSize === -1 ? sorted : sorted.slice(page * pageSize, (page + 1) * pageSize), total: rows.length };
}

/** Case-insensitive "any field contains the term". */
export function matches(term: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  if (!term) return true;
  const t = term.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(t));
}

/** Random ids for runtime records. Seed ids look like `p_0001`, so these never collide. */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const nowISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Next reference number for a prefix; call inside `commit` so the counter is saved with the record. */
export function takeRef(draft: DB, prefix: string, date: string = nowISO()): string {
  const n = (draft.meta.counters[prefix] ?? 0) + 1;
  draft.meta.counters[prefix] = n;
  return nextRef(prefix, Number(date.slice(0, 4)), n);
}

/** Whole days between an ISO date and today (local), never negative. */
export function daysSince(date: string, now: string = nowISO()): number {
  const a = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const b = Date.UTC(+now.slice(0, 4), +now.slice(5, 7) - 1, +now.slice(8, 10));
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** "Transaction edit days": a final transaction older than N days is locked (0 = never locks). */
export function assertEditWindow(d: DB, date: string): void {
  const days = d.settings.business.transactionEditDays;
  if (days > 0 && daysSince(date) > days) throw new EditWindowExpiredError();
}
