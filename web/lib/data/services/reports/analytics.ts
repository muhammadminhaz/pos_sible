import { service } from "@/lib/data/api/facade";
import { addDays, differenceInCalendarDays, format, getDay, getHours, parseISO, startOfMonth } from "date-fns";
import type { DB, Transaction } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { expenseSign } from "@/lib/domain/ledger";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay, anyOf } from "../_util";
import { dayOf, inScope, isFinalSale, isReceivedPurchase, lineCostOf, lineFilter, lineTax, names, narrowsItems, sumBy, type ReportFilter, type SalesScope } from "./_shared";
import { profitBreakdown } from "./money";

/**
 * Business analytics: read-only aggregates over the same transactions the reports use. Returns are always netted off.
 * Sales figures follow the item and customer filters; expenses, purchases and supplier balances are the whole business.
 */

const exTax = (t: Transaction) => t.totals.total - t.totals.orderTax;
const pct = (a: number, b: number) => (b ? roundMoney((a / b) * 100) : 0);

type Slice = { share: number; cost: number };
/**
 * The part of a sale or return the filter keeps: its share of the document's ex-tax value (order-level discount and
 * charges spread by line value, as in `profitBreakdown`) and the cost of the kept lines. Null when nothing is kept.
 */
export function slicer(d: DB, f: SalesScope): (t: Transaction) => Slice | null {
  const keep = lineFilter(d, f);
  const items = narrowsItems(f);
  return (t) => {
    if (f.contactId && !anyOf(f.contactId, t.contactId)) return null;
    const costOf = (l: Transaction["lines"][number]) => (t.type === "sell_return" ? l.qty * l.unitCost : lineCostOf(l));
    if (!items) return { share: 1, cost: sumBy(t.lines, costOf) };
    const kept = t.lines.filter(keep);
    if (!kept.length) return null;
    const value = (l: Transaction["lines"][number]) => l.subtotal - lineTax(l);
    const all = sumBy(t.lines, value);
    return { share: all > 0 ? sumBy(kept, value) / all : kept.length / t.lines.length, cost: sumBy(kept, costOf) };
  };
}
const unscoped = (f: SalesScope): ReportFilter => ({ from: f.from, to: f.to, locationId: f.locationId });

type Range = { from: string; to: string };
const rangeOf = (d: DB, f: ReportFilter): Range => {
  const to = f.to ?? todayISO(d.settings.business.timeZone);
  return { from: f.from ?? format(addDays(parseISO(to), -29), "yyyy-MM-dd"), to };
};

/** The period of equal length right before `r`. */
export function previousRange(r: Range): Range {
  const n = differenceInCalendarDays(parseISO(r.to), parseISO(r.from)) + 1;
  const to = addDays(parseISO(r.from), -1);
  return { from: format(addDays(to, -(n - 1)), "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
}

// ── Overview ────────────────────────────────────────────────────────────

export type Headline = { sales: number; grossProfit: number; netProfit: number; margin: number; orders: number; aov: number; expenses: number; purchases: number };
export type TrendRow = { bucket: string; sales: number; profit: number };
export type AnalyticsOverview = {
  current: Headline; previous: Headline;
  trend: TrendRow[]; granularity: "day" | "month";
  receivables: number; payables: number;
};

/** Net profit is always the whole business: a filtered gross profit minus every expense would mean nothing. */
export function headline(d: DB, f: SalesScope): Headline {
  const slice = slicer(d, f), whole = slicer(d, {});
  let sales = 0, cogs = 0, allGross = 0, expenses = 0, purchases = 0, orders = 0;
  for (const t of d.transactions) {
    if (!inScope(t, f)) continue;
    if (isFinalSale(t) || t.type === "sell_return") {
      const sign = t.type === "sell_return" ? -1 : 1;
      const w = whole(t)!;
      allGross += sign * (exTax(t) - w.cost);
      const s = slice(t);
      if (!s) continue;
      sales += sign * exTax(t) * s.share;
      cogs += sign * s.cost;
      if (sign > 0) orders++;
    }
    else if (t.type === "expense") expenses += expenseSign(t) * t.totals.total;
    else if (isReceivedPurchase(t)) purchases += t.totals.total;
    else if (t.type === "purchase_return") purchases -= t.totals.total;
  }
  const grossProfit = roundMoney(sales - cogs);
  return {
    sales: roundMoney(sales), grossProfit, netProfit: roundMoney(allGross - expenses), margin: pct(grossProfit, sales),
    orders, aov: orders ? roundMoney(sales / orders) : 0, expenses: roundMoney(expenses), purchases: roundMoney(purchases),
  };
}

export function overview(d: DB, f: SalesScope): AnalyticsOverview {
  const r = rangeOf(d, f);
  const scope = { ...f, ...r };
  const days = differenceInCalendarDays(parseISO(r.to), parseISO(r.from)) + 1;
  const granularity = days > 92 ? "month" : "day";
  const key = (iso: string) => (granularity === "month" ? format(startOfMonth(parseISO(iso)), "yyyy-MM") : dayOf(iso));
  const acc = new Map<string, TrendRow>();
  // No empty buckets in the future: a month-to-date view ends today, not at month end.
  const shown = Math.min(days, Math.max(1, differenceInCalendarDays(parseISO(todayISO(d.settings.business.timeZone)), parseISO(r.from)) + 1));
  if (granularity === "day") for (let i = 0; i < shown; i++) { const b = format(addDays(parseISO(r.from), i), "yyyy-MM-dd"); acc.set(b, { bucket: b, sales: 0, profit: 0 }); }
  const slice = slicer(d, f);
  for (const t of d.transactions) {
    if (!inScope(t, scope) || !(isFinalSale(t) || t.type === "sell_return")) continue;
    const s = slice(t);
    if (!s) continue;
    const sign = t.type === "sell_return" ? -1 : 1;
    const value = exTax(t) * s.share;
    const row = acc.get(key(t.date)) ?? { bucket: key(t.date), sales: 0, profit: 0 };
    row.sales += sign * value;
    row.profit += sign * (value - s.cost);
    acc.set(row.bucket, row);
  }
  const trend = [...acc.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).map((x) => ({ ...x, sales: roundMoney(x.sales), profit: roundMoney(x.profit) }));
  // Balances are per document, so only the customer filter applies to what customers owe.
  let receivables = 0, payables = 0;
  for (const t of d.transactions) {
    if (f.locationId && !anyOf(f.locationId, t.locationId)) continue;
    if (isFinalSale(t)) { if (!f.contactId || anyOf(f.contactId, t.contactId)) receivables += paymentSummary(t.totals.total, t.payments).due; }
    else if (isReceivedPurchase(t)) payables += paymentSummary(t.totals.total, t.payments).due;
  }
  return { current: headline(d, scope), previous: headline(d, { ...f, ...previousRange(r) }), trend, granularity, receivables: roundMoney(receivables), payables: roundMoney(payables) };
}

// ── Sales patterns ──────────────────────────────────────────────────────

export type SalesPatterns = {
  /** `[weekday 0=Sunday][hour]` of sales value, for finding the busiest times. */
  heat: number[][];
  byPayment: { method: string; amount: number }[];
  byLocation: { name: string; sales: number }[];
  discounts: { given: number; pctOfSales: number };
  returns: { amount: number; pctOfSales: number };
};

/** With item filters, each sale counts for the share of it the kept lines make up. */
export function salesPatterns(d: DB, f: SalesScope): SalesPatterns {
  const scope = { ...f, ...rangeOf(d, f) };
  const slice = slicer(d, f);
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const pay = new Map<string, number>(), loc = new Map<string, number>();
  let gross = 0, discount = 0, returned = 0;
  for (const t of d.transactions) {
    if (!inScope(t, scope) || !(isFinalSale(t) || t.type === "sell_return")) continue;
    const s = slice(t);
    if (!s) continue;
    if (isFinalSale(t)) {
      const at = parseISO(t.date);
      heat[getDay(at)][getHours(at)] += t.totals.total * s.share;
      gross += t.totals.total * s.share;
      discount += t.totals.discount * s.share;
      loc.set(t.locationId, (loc.get(t.locationId) ?? 0) + exTax(t) * s.share);
      for (const p of t.payments) pay.set(p.method, (pay.get(p.method) ?? 0) + (p.isReturn ? -p.amount : p.amount) * s.share);
    } else returned += t.totals.total * s.share;
  }
  return {
    heat: heat.map((row) => row.map((v) => roundMoney(v))),
    byPayment: [...pay].map(([method, amount]) => ({ method, amount: roundMoney(amount) })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount),
    byLocation: [...loc].map(([id, v]) => ({ name: names.location(d, id), sales: roundMoney(v) })).sort((a, b) => b.sales - a.sales),
    discounts: { given: roundMoney(discount), pctOfSales: pct(discount, gross + discount) },
    returns: { amount: roundMoney(returned), pctOfSales: pct(returned, gross) },
  };
}

// ── Products ────────────────────────────────────────────────────────────

export type ParetoRow = { label: string; sales: number; cumulative: number; cls: "A" | "B" | "C" };
export type DeadStockRow = { variationId: string; label: string; stock: number; value: number; daysSinceSale: number | null };
export type ProductAnalytics = {
  topByProfit: { label: string; profit: number; margin: number }[];
  topBySales: { label: string; sales: number }[];
  pareto: ParetoRow[];
  /** Products in class A across the whole range, not just the 25 charted. */
  classACount: number;
  deadStock: DeadStockRow[];
  deadStockDays: number;
};

const DEAD_STOCK_DAYS = 60;

export function productAnalytics(d: DB, f: SalesScope): ProductAnalytics {
  const scope = { ...f, ...rangeOf(d, f) };
  const rows = profitBreakdown(d, "product", scope).rows.filter((r) => r.sales > 0);
  const bySales = [...rows].sort((a, b) => b.sales - a.sales);
  const total = bySales.reduce((s, r) => s + r.sales, 0);
  let run = 0;
  const full = bySales.map((r): ParetoRow => {
    const before = total ? (run / total) * 100 : 0;
    run += r.sales;
    return { label: r.label, sales: r.sales, cumulative: pct(run, total), cls: before < 80 ? "A" : before < 95 ? "B" : "C" };
  });
  const pareto = full.slice(0, 25);

  // Dead stock: units on the shelf and nothing sold for DEAD_STOCK_DAYS, valued at what they cost. Item filters only.
  const keep = lineFilter(d, f);
  const today = scope.to;
  const lastSale = new Map<string, string>();
  for (const t of d.transactions) {
    if (!isFinalSale(t) || (f.locationId && !anyOf(f.locationId, t.locationId))) continue;
    for (const l of t.lines) if (dayOf(t.date) > (lastSale.get(l.variationId) ?? "")) lastSale.set(l.variationId, dayOf(t.date));
  }
  const held = new Map<string, { qty: number; value: number }>();
  for (const l of d.stockLots) {
    if (l.qtyRemaining <= 0 || (f.locationId && !anyOf(f.locationId, l.locationId))) continue;
    const h = held.get(l.variationId) ?? { qty: 0, value: 0 };
    h.qty += l.qtyRemaining; h.value += l.qtyRemaining * l.unitCost;
    held.set(l.variationId, h);
  }
  const deadStock: DeadStockRow[] = [];
  for (const [variationId, h] of held) {
    const v = d.variations.find((x) => x.id === variationId);
    const p = v && d.products.find((x) => x.id === v.productId);
    if (!v || !p || !keep({ productId: p.id })) continue;
    const last = lastSale.get(variationId);
    const since = last ? differenceInCalendarDays(parseISO(today), parseISO(last)) : null;
    if (since !== null && since < DEAD_STOCK_DAYS) continue;
    deadStock.push({ variationId, label: p.type === "variable" ? `${p.name} (${v.name})` : p.name, stock: roundMoney(h.qty, 4), value: roundMoney(h.value), daysSinceSale: since });
  }
  deadStock.sort((a, b) => b.value - a.value);
  return {
    topByProfit: [...rows].sort((a, b) => b.profit - a.profit).slice(0, 10).map((r) => ({ label: r.label, profit: r.profit, margin: r.margin })),
    topBySales: bySales.slice(0, 10).map((r) => ({ label: r.label, sales: r.sales })),
    pareto, classACount: full.filter((r) => r.cls === "A").length, deadStock: deadStock.slice(0, 15), deadStockDays: DEAD_STOCK_DAYS,
  };
}

// ── Customers ───────────────────────────────────────────────────────────

export const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90plus"] as const;
export type CustomerAnalytics = {
  topCustomers: { label: string; sales: number; profit: number }[];
  newVsReturning: { bucket: string; newCustomers: number; returning: number }[];
  totals: { newCustomers: number; returning: number; repeatRate: number };
  aging: { bucket: (typeof AGING_BUCKETS)[number]; amount: number }[];
};

export function customerAnalytics(d: DB, f: SalesScope): CustomerAnalytics {
  const r = rangeOf(d, f);
  const scope = { ...f, ...r };
  const topCustomers = profitBreakdown(d, "customer", scope).rows.filter((x) => x.key && x.sales > 0).slice(0, 10).map((x) => ({ label: x.label, sales: x.sales, profit: x.profit }));

  // A customer is "new" in the period their first-ever sale falls in (any location).
  const first = new Map<string, string>();
  for (const t of d.transactions) if (isFinalSale(t) && t.contactId && dayOf(t.date) < (first.get(t.contactId) ?? "9999")) first.set(t.contactId, dayOf(t.date));
  const monthly = new Map<string, { n: Set<string>; r: Set<string> }>();
  const seen = new Set<string>();
  const slice = slicer(d, f);
  for (const t of d.transactions) {
    if (!isFinalSale(t) || !t.contactId || !inScope(t, scope) || !slice(t)) continue;
    const b = format(startOfMonth(parseISO(t.date)), "yyyy-MM");
    const m = monthly.get(b) ?? { n: new Set(), r: new Set() };
    (first.get(t.contactId)! >= r.from ? m.n : m.r).add(t.contactId);
    monthly.set(b, m);
    seen.add(t.contactId);
  }
  const newCount = [...seen].filter((id) => first.get(id)! >= r.from).length;
  const aging = new Map(AGING_BUCKETS.map((b) => [b, 0]));
  const today = todayISO(d.settings.business.timeZone);
  for (const t of d.transactions) {
    if (!isFinalSale(t) || (f.locationId && !anyOf(f.locationId, t.locationId)) || (f.contactId && !anyOf(f.contactId, t.contactId))) continue;
    const due = paymentSummary(t.totals.total, t.payments).due;
    if (due <= 0) continue;
    const age = differenceInCalendarDays(parseISO(today), parseISO(t.date));
    const b = age <= 0 ? "current" : age <= 30 ? "d1_30" : age <= 60 ? "d31_60" : age <= 90 ? "d61_90" : "d90plus";
    aging.set(b, (aging.get(b) ?? 0) + due);
  }
  return {
    topCustomers,
    newVsReturning: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, m]) => ({ bucket, newCustomers: m.n.size, returning: m.r.size })),
    totals: { newCustomers: newCount, returning: seen.size - newCount, repeatRate: pct(seen.size - newCount, seen.size) },
    aging: AGING_BUCKETS.map((bucket) => ({ bucket, amount: roundMoney(aging.get(bucket) ?? 0) })),
  };
}

// ── Inventory ───────────────────────────────────────────────────────────

export type ReorderRow = { variationId: string; label: string; stock: number; perDay: number; daysLeft: number; suggest: number };
const COVER_DAYS = 30;

/** Days of stock left at the period's selling pace, with a quantity that would cover the next 30 days. */
export function reorderSuggestions(d: DB, f: SalesScope): { rows: ReorderRow[]; coverDays: number } {
  const r = rangeOf(d, f);
  const days = differenceInCalendarDays(parseISO(r.to), parseISO(r.from)) + 1;
  // Selling pace comes from every buyer, so only the item filters narrow it.
  const keep = lineFilter(d, f);
  const sold = new Map<string, number>();
  for (const t of d.transactions) {
    if (!inScope(t, { ...f, ...r }) || !(isFinalSale(t) || t.type === "sell_return")) continue;
    const sign = t.type === "sell_return" ? -1 : 1;
    for (const l of t.lines) if (keep(l)) sold.set(l.variationId, (sold.get(l.variationId) ?? 0) + sign * l.qty);
  }
  const stock = new Map<string, number>();
  for (const l of d.stockLots) if (!f.locationId || anyOf(f.locationId, l.locationId)) stock.set(l.variationId, (stock.get(l.variationId) ?? 0) + l.qtyRemaining);
  const rows: ReorderRow[] = [];
  for (const [variationId, qty] of sold) {
    const perDay = qty / days;
    const v = d.variations.find((x) => x.id === variationId);
    const p = v && d.products.find((x) => x.id === v.productId);
    if (perDay <= 0 || !v || !p || !p.manageStock) continue;
    const have = stock.get(variationId) ?? 0;
    const daysLeft = Math.floor(have / perDay);
    if (daysLeft > COVER_DAYS) continue;
    rows.push({ variationId, label: p.type === "variable" ? `${p.name} (${v.name})` : p.name, stock: roundMoney(have, 4), perDay: roundMoney(perDay, 2), daysLeft, suggest: Math.ceil(perDay * COVER_DAYS - have) });
  }
  return { rows: rows.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 20), coverDays: COVER_DAYS };
}

// ── Expenses ────────────────────────────────────────────────────────────

export type ExpenseAnalytics = { byCategory: { label: string; amount: number; share: number }[]; total: number; ratio: number };

export function expenseAnalytics(d: DB, f: SalesScope): ExpenseAnalytics {
  const scope = { ...unscoped(f), ...rangeOf(d, f) };
  const acc = new Map<string, number>();
  for (const t of d.transactions) if (t.type === "expense" && inScope(t, scope)) acc.set(t.expenseCategoryId ?? "", (acc.get(t.expenseCategoryId ?? "") ?? 0) + expenseSign(t) * t.totals.total);
  const total = roundMoney([...acc.values()].reduce((s, v) => s + v, 0));
  const byCategory = [...acc]
    .map(([id, amount]) => ({ label: d.expenseCategories.find((c) => c.id === id)?.name ?? "", amount: roundMoney(amount), share: pct(amount, total) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { byCategory, total, ratio: pct(total, headline(d, scope).sales) };
}

/** Day of the oldest record, so "All time" starts where the business does. */
export function firstDate(d: DB): string | null {
  let min: string | null = null;
  for (const t of d.transactions) { const x = dayOf(t.date); if (!min || x < min) min = x; }
  return min;
}

export const analyticsReports = service("analyticsReports", {
  async firstDate() { await delay(); return firstDate(getDB()); },
  async overview(f: SalesScope = {}) { await delay(); return overview(getDB(), f); },
  async sales(f: SalesScope = {}) { await delay(); return salesPatterns(getDB(), f); },
  async products(f: SalesScope = {}) { await delay(); return productAnalytics(getDB(), f); },
  async customers(f: SalesScope = {}) { await delay(); return customerAnalytics(getDB(), f); },
  async reorder(f: SalesScope = {}) { await delay(); return reorderSuggestions(getDB(), f); },
  async expenses(f: SalesScope = {}) { await delay(); return expenseAnalytics(getDB(), f); },
});
