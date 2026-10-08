import { service } from "@/lib/data/api/facade";
import { addDays, differenceInCalendarDays, endOfMonth, endOfQuarter, endOfYear, format, getDay, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths, subQuarters, subYears } from "date-fns";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { goal, GOAL_METRICS, GOAL_PERIODS, type DB, type Goal, type GoalMetric, type GoalPeriod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay, nowISO, uid, anyOf } from "../_util";
import { headline, productAnalytics, reorderSuggestions, salesPatterns } from "./analytics";
import { dayOf, inScope, isFinalSale, type ReportFilter } from "./_shared";
import { profitBreakdown } from "./money";

/**
 * The "possible" side of the numbers: where this month is heading, what the shop could do next, and how far along its
 * goals are. Every figure comes from the shop's own transactions; nothing here is a guess from outside data.
 */

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const exTax = (t: DB["transactions"][number]) => t.totals.total - t.totals.orderTax;
const today = (d: DB) => todayISO(d.settings.business.timeZone);

/** Net sales (ex tax, returns taken off) per day in [from, to]. */
function dailySales(d: DB, f: ReportFilter): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of d.transactions) {
    if (!inScope(t, f) || !(isFinalSale(t) || t.type === "sell_return")) continue;
    const day = dayOf(t.date);
    out.set(day, (out.get(day) ?? 0) + (t.type === "sell_return" ? -1 : 1) * exTax(t));
  }
  return out;
}

// ── Forecast ────────────────────────────────────────────────────────────

export type ForecastPoint = { day: string; actual: number | null; projected: number | null };
export type Forecast = { mtd: number; projected: number; lastMonth: number; daysLeft: number; series: ForecastPoint[] };

/**
 * Month-end sales: what is in so far, plus each remaining day at the average of the same weekday over the last four
 * weeks (a shop's Friday is not its Tuesday). The series is cumulative so the projection reads as a line that keeps going.
 */
export function forecast(d: DB, f: ReportFilter = {}): Forecast {
  const now = parseISO(today(d));
  const from = startOfMonth(now), end = endOfMonth(now);
  const byDay = dailySales(d, { ...f, from: iso(addDays(now, -28)), to: iso(now) });
  const weekday = Array<number>(7).fill(0);
  for (let i = 1; i <= 28; i++) { const day = addDays(now, -i); weekday[getDay(day)] += (byDay.get(iso(day)) ?? 0) / 4; }

  const month = dailySales(d, { ...f, from: iso(from), to: iso(now) });
  const series: ForecastPoint[] = [];
  let run = 0;
  for (let day = from; day <= end; day = addDays(day, 1)) {
    const key = iso(day);
    if (day <= now) {
      run += month.get(key) ?? 0;
      series.push({ day: key, actual: roundMoney(run), projected: key === iso(now) ? roundMoney(run) : null });
    } else {
      run += weekday[getDay(day)];
      series.push({ day: key, actual: null, projected: roundMoney(run) });
    }
  }
  const mtd = series.find((p) => p.day === iso(now))?.actual ?? 0;
  const prev = subMonths(now, 1);
  return {
    mtd,
    projected: roundMoney(run),
    lastMonth: headline(d, { ...f, from: iso(startOfMonth(prev)), to: iso(endOfMonth(prev)) }).sales,
    daysLeft: differenceInCalendarDays(end, now),
    series,
  };
}

// ── Opportunities ───────────────────────────────────────────────────────

/** `impact` is money the shop can gain or free up in about a month; 0 means a tip worth knowing, not a sum. */
export type Opportunity =
  | { id: string; kind: "restock"; impact: number; product: string; daysLeft: number; by: string; suggest: number }
  | { id: string; kind: "winBack"; impact: number; count: number; names: string[]; days: number }
  | { id: string; kind: "collect"; impact: number; count: number; names: string[] }
  | { id: string; kind: "clearStock"; impact: number; count: number; top: string; days: number }
  | { id: string; kind: "price"; impact: number; product: string; margin: number; raise: number }
  | { id: string; kind: "peak"; impact: 0; weekday: number; hour: number };

const LAPSED_DAYS = 45, LOST_DAYS = 180, OVERDUE_DAYS = 30, URGENT_DAYS = 7, THIN_MARGIN = 15, PRICE_RAISE = 5;

export function opportunities(d: DB, f: ReportFilter = {}): Opportunity[] {
  const to = today(d);
  const now = parseISO(to);
  const last30 = { ...f, from: iso(addDays(now, -29)), to };
  const out: Opportunity[] = [];

  // Fast sellers about to run out: the sales those empty shelf days would have made.
  const price = new Map<string, { amount: number; qty: number }>();
  for (const t of d.transactions) {
    if (!isFinalSale(t) || !inScope(t, last30)) continue;
    for (const l of t.lines) { const p = price.get(l.variationId) ?? { amount: 0, qty: 0 }; p.amount += l.subtotal; p.qty += l.qty; price.set(l.variationId, p); }
  }
  for (const r of reorderSuggestions(d, last30).rows) {
    if (r.daysLeft > URGENT_DAYS) continue;
    const p = price.get(r.variationId);
    const unit = p && p.qty ? p.amount / p.qty : 0;
    out.push({ id: `restock:${r.variationId}`, kind: "restock", impact: roundMoney(r.perDay * unit * (30 - r.daysLeft)), product: r.label, daysLeft: r.daysLeft, by: iso(addDays(now, Math.max(0, r.daysLeft - 1))), suggest: r.suggest });
  }

  // Regulars who stopped coming: one more visit each, at their usual basket.
  const visits = new Map<string, { n: number; spent: number; last: string }>();
  const dues = new Map<string, number>();
  // A return on a credit sale cuts what is still owed on it.
  const returned = new Map<string, number>();
  for (const t of d.transactions) if (t.type === "sell_return" && t.parentId) returned.set(t.parentId, (returned.get(t.parentId) ?? 0) + t.totals.total);
  for (const t of d.transactions) {
    if (!isFinalSale(t) || !t.contactId || (f.locationId && !anyOf(f.locationId, t.locationId))) continue;
    const v = visits.get(t.contactId) ?? { n: 0, spent: 0, last: "" };
    v.n++; v.spent += exTax(t); if (dayOf(t.date) > v.last) v.last = dayOf(t.date);
    visits.set(t.contactId, v);
    const due = paymentSummary(t.totals.total, t.payments).due - (returned.get(t.id) ?? 0);
    if (due > 0 && differenceInCalendarDays(now, parseISO(dayOf(t.date))) > OVERDUE_DAYS) dues.set(t.contactId, (dues.get(t.contactId) ?? 0) + due);
  }
  const contactName = (id: string) => d.contacts.find((c) => c.id === id)?.name ?? "";
  const lapsed = [...visits]
    .filter(([, v]) => { const gap = differenceInCalendarDays(now, parseISO(v.last)); return v.n >= 2 && gap >= LAPSED_DAYS && gap <= LOST_DAYS; })
    .map(([id, v]) => ({ id, basket: v.spent / v.n }))
    .sort((a, b) => b.basket - a.basket);
  if (lapsed.length) out.push({ id: "winBack", kind: "winBack", impact: roundMoney(lapsed.reduce((s, x) => s + x.basket, 0)), count: lapsed.length, names: lapsed.slice(0, 3).map((x) => contactName(x.id)), days: LAPSED_DAYS });

  // Money customers have owed for over a month.
  const owed = [...dues].sort((a, b) => b[1] - a[1]);
  if (owed.length) out.push({ id: "collect", kind: "collect", impact: roundMoney(owed.reduce((s, [, v]) => s + v, 0)), count: owed.length, names: owed.slice(0, 3).map(([id]) => contactName(id)) });

  // Cash sitting on the shelf in stock nobody has bought for two months.
  const prod = productAnalytics(d, last30);
  if (prod.deadStock.length) out.push({ id: "clearStock", kind: "clearStock", impact: roundMoney(prod.deadStock.reduce((s, x) => s + x.value, 0)), count: prod.deadStock.length, top: prod.deadStock[0].label, days: prod.deadStockDays });

  // Good sellers on a thin margin: what a small price rise would add over a month at the same volume.
  const thin = profitBreakdown(d, "product", last30).rows.filter((r) => r.sales > 0 && r.margin < THIN_MARGIN).sort((a, b) => b.sales - a.sales).slice(0, 2);
  for (const r of thin) out.push({ id: `price:${r.key}`, kind: "price", impact: roundMoney((r.sales * PRICE_RAISE) / 100), product: r.label, margin: r.margin, raise: PRICE_RAISE });

  // The busiest hour of the week over the last eight weeks: worth being fully stocked and staffed for.
  const heat = salesPatterns(d, { ...f, from: iso(addDays(now, -55)), to }).heat;
  let best = { weekday: 0, hour: 0, v: 0 };
  heat.forEach((row, w) => row.forEach((v, h) => { if (v > best.v) best = { weekday: w, hour: h, v }; }));
  if (best.v > 0) out.push({ id: "peak", kind: "peak", impact: 0, weekday: best.weekday, hour: best.hour });

  return out.filter((o) => o.kind === "peak" || o.impact > 0).sort((a, b) => b.impact - a.impact);
}

// ── Goals ───────────────────────────────────────────────────────────────

export type GoalStatus = "achieved" | "ahead" | "behind" | "over";
export type GoalProgress = Goal & {
  from: string; to: string;
  value: number;
  /** Where the period should end at today's pace (the value itself for averages). */
  projected: number;
  /** Share of the period gone, 0 to 100. */
  elapsed: number;
  /** Days after today left in the period. */
  daysLeft: number;
  status: GoalStatus;
  previous: number;
};

const PERIOD = {
  month: [startOfMonth, endOfMonth, subMonths],
  quarter: [startOfQuarter, endOfQuarter, subQuarters],
  year: [startOfYear, endOfYear, subYears],
} as const;

export function periodRange(period: GoalPeriod, todayIso: string, back = 0): { from: string; to: string } {
  const [start, end, sub] = PERIOD[period];
  const at = sub(parseISO(todayIso), back);
  return { from: iso(start(at)), to: iso(end(at)) };
}

export function metricValue(d: DB, metric: GoalMetric, f: ReportFilter): number {
  if (metric === "newCustomers" || metric === "activeCustomers") {
    const first = new Map<string, string>(), seen = new Set<string>();
    for (const t of d.transactions) {
      if (!isFinalSale(t) || !t.contactId) continue;
      if (dayOf(t.date) < (first.get(t.contactId) ?? "9999")) first.set(t.contactId, dayOf(t.date));
      if (inScope(t, f)) seen.add(t.contactId);
    }
    return metric === "activeCustomers" ? seen.size : [...seen].filter((id) => first.get(id)! >= f.from!).length;
  }
  return headline(d, f)[metric];
}

export function goalProgress(d: DB, g: Goal): GoalProgress {
  const now = today(d);
  const { from, to } = periodRange(g.period, now);
  const total = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  const gone = Math.min(total, differenceInCalendarDays(parseISO(now), parseISO(from)) + 1);
  const value = metricValue(d, g.metric, { from, to: now });
  // Averages and head counts do not add up over time (a repeat customer is not a new one), so their pace is the value itself.
  const projected = g.metric === "aov" || g.metric === "activeCustomers" ? value : roundMoney((value / gone) * total);
  const ceiling = g.metric === "expenses";
  const status: GoalStatus = ceiling
    ? value > g.target ? "over" : projected > g.target ? "behind" : "ahead"
    : value >= g.target ? "achieved" : projected >= g.target ? "ahead" : "behind";
  return {
    ...g, from, to, value: roundMoney(value), projected, elapsed: Math.round((gone / total) * 100), daysLeft: total - gone, status,
    previous: roundMoney(metricValue(d, g.metric, periodRange(g.period, now, 1))),
  };
}

export type GoalInput = { id?: string; metric: GoalMetric; target: number; period: GoalPeriod; note?: string };

export const possibleReports = service("possibleReports", {
  async forecast(f: ReportFilter = {}) { await delay(); return forecast(getDB(), f); },
  async opportunities(f: ReportFilter = {}) { await delay(); return opportunities(getDB(), f); },
});

export const goalsService = service("goalsService", {
  /** Last full period's figure for a metric, to suggest a target from. */
  async baseline(metric: GoalMetric, period: GoalPeriod): Promise<number> {
    await delay();
    if (!(GOAL_METRICS as readonly string[]).includes(metric) || !(GOAL_PERIODS as readonly string[]).includes(period)) throw new ValidationError({ metric: "required" });
    const d = getDB();
    return roundMoney(metricValue(d, metric, periodRange(period, today(d), 1)));
  },
  async list(): Promise<GoalProgress[]> {
    await delay();
    const d = getDB();
    return (d.goals ?? []).map((g) => goalProgress(d, g));
  },
  async save(input: GoalInput): Promise<string> {
    await delay();
    assertCan("report.view");
    if (!(GOAL_METRICS as readonly string[]).includes(input.metric)) throw new ValidationError({ metric: "required" });
    if (!(GOAL_PERIODS as readonly string[]).includes(input.period)) throw new ValidationError({ period: "required" });
    if (!(typeof input.target === "number" && input.target > 0 && input.target <= 1e12)) throw new ValidationError({ target: "positive" });
    let id = input.id ?? "";
    commit((d) => {
      d.goals ??= [];
      const fields = { metric: input.metric, target: input.target, period: input.period, note: String(input.note ?? "") };
      if (input.id) {
        const i = d.goals.findIndex((x) => x.id === input.id);
        if (i < 0) throw new NotFoundError("Goal");
        d.goals[i] = goal.parse({ ...d.goals[i], ...fields });
      } else {
        id = uid("goal");
        d.goals.push(goal.parse({ ...fields, id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null }));
      }
    });
    return id;
  },
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("report.view");
    commit((d) => { d.goals = (d.goals ?? []).filter((x) => x.id !== id); });
  },
});
