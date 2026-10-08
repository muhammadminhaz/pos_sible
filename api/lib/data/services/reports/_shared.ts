import type { DB, Transaction, TxnLine, User } from "@/lib/data/schemas";
import { roundMoney } from "@/lib/domain/money";
import { anyOf } from "../_util";

/** Every report filters the same way: inclusive `yyyy-MM-dd` days and an optional location (null/absent = all). */
export type ReportFilter = { from?: string; to?: string; locationId?: string | null };
export type Totals<R> = Partial<Record<keyof R & string, number>>;
export type ReportResult<R> = { rows: R[]; totals: Totals<R> };

export const dayOf = (iso: string) => iso.slice(0, 10);

export const inScope = (t: { date: string; locationId: string }, f: ReportFilter) => {
  const d = dayOf(t.date);
  return (!f.from || d >= f.from) && (!f.to || d <= f.to) && (!f.locationId || anyOf(f.locationId, t.locationId));
};

export const isFinalSale = (t: Transaction) => t.type === "sell" && t.status === "final";
export const isReceivedPurchase = (t: Transaction) => t.type === "purchase" && t.status === "received";

/** What a line's stock cost: the lots it actually took from, not today's purchase price. */
export const lineCostOf = (l: Pick<TxnLine, "qty" | "unitCost" | "allocations">) =>
  roundMoney(l.allocations.length ? l.allocations.reduce((s, a) => s + a.qty * a.unitCost, 0) : l.qty * l.unitCost);

/** Line subtotals are tax-inclusive, so the tax is the share of the subtotal above the rate. */
export const lineTax = (l: Pick<TxnLine, "subtotal" | "taxRate">) => roundMoney((l.subtotal * l.taxRate) / (100 + l.taxRate));

export const sumBy = <T>(xs: T[], pick: (x: T) => number) => roundMoney(xs.reduce((s, x) => s + pick(x), 0));

export function groupSum<T>(xs: T[], key: (x: T) => string, pick: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), roundMoney((m.get(key(x)) ?? 0) + pick(x)));
  return m;
}

export const userLabel = (users: Pick<User, "id" | "firstName" | "lastName">[], id: string | null | undefined) => {
  const u = users.find((x) => x.id === id);
  return u ? `${u.firstName} ${u.lastName}`.trim() : "";
};

/** `{ rows, totals }` where totals sums the named numeric columns. */
export function withTotals<R>(rows: R[], cols: (keyof R & string)[]): ReportResult<R> {
  const totals: Totals<R> = {};
  for (const c of cols) totals[c] = sumBy(rows, (r) => Number(r[c]) || 0);
  return { rows, totals };
}

export const names = {
  location: (d: DB, id: string | null | undefined) => d.locations.find((l) => l.id === id)?.name ?? "",
  contact: (d: DB, id: string | null | undefined) => d.contacts.find((c) => c.id === id)?.name ?? "",
};
