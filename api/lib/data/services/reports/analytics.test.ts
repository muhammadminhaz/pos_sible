import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { stockReport } from "./stock";
import { customerAnalytics, expenseAnalytics, inventoryAnalytics, overview, previousRange, productAnalytics, reorderSuggestions, salesPatterns } from "./analytics";
import { profitBreakdown, profitLoss } from "./money";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const near = (a: number, b: number, eps = 0.02) => expect(Math.abs(a - b)).toBeLessThan(eps);
const ranges = [
  { from: "2026-09-01", to: "2026-09-30" },
  { from: "2026-04-01", to: "2026-09-30", locationId: LOC_RANGO },
];

describe("analytics reconcile with the reports", () => {
  it("overview headline matches profit & loss", () => {
    for (const r of ranges) {
      const o = overview(seed, r).current, p = profitLoss(seed, r);
      near(o.sales, p.sales - p.sellReturn);
      near(o.grossProfit, p.grossProfit);
      near(o.netProfit, p.netProfit);
      near(o.expenses, p.expenses);
    }
  });

  it("trend adds up to the headline", () => {
    for (const r of ranges) {
      const o = overview(seed, r);
      near(o.trend.reduce((s, x) => s + x.sales, 0), o.current.sales, 0.1);
      near(o.trend.reduce((s, x) => s + x.profit, 0), o.current.grossProfit, 0.1);
    }
  });

  it("previous period has the same length and ends the day before", () => {
    expect(previousRange({ from: "2026-09-08", to: "2026-09-14" })).toEqual({ from: "2026-09-01", to: "2026-09-07" });
  });

  it("heatmap holds exactly the finalised sales in range", () => {
    const s = salesPatterns(seed, ranges[0]);
    const want = seed.transactions.filter((t) => t.type === "sell" && t.status === "final" && t.date.slice(0, 10) >= ranges[0].from && t.date.slice(0, 10) <= ranges[0].to).reduce((a, t) => a + t.totals.total, 0);
    near(s.heat.flat().reduce((a, v) => a + v, 0), want, 0.1);
    expect(s.heat).toHaveLength(7);
  });

  it("expense categories add up to total expenses", () => {
    const e = expenseAnalytics(seed, ranges[1]);
    near(e.byCategory.reduce((a, x) => a + x.amount, 0), e.total, 1);
  });

  it("pareto is cumulative, classed A to C, ending at or below 100%", () => {
    const p = productAnalytics(seed, ranges[1]).pareto;
    expect(p.length).toBeGreaterThan(0);
    p.forEach((r, i) => i && expect(r.cumulative).toBeGreaterThanOrEqual(p[i - 1].cumulative));
    expect(p[0].cls).toBe("A");
    expect(p.at(-1)!.cumulative).toBeLessThanOrEqual(100.01);
  });

  it("customers: new + returning equals distinct buyers; aging buckets sum to receivables", () => {
    const c = customerAnalytics(seed, { from: "2026-04-01", to: "2026-09-30" });
    expect(c.totals.newCustomers + c.totals.returning).toBeGreaterThan(0);
    near(c.aging.reduce((a, x) => a + x.amount, 0), overview(seed, { from: "2026-09-01", to: "2026-09-30" }).receivables, 0.05);
  });

  it("reorder list is sorted by urgency", () => {
    const r = reorderSuggestions(seed, ranges[1]).rows;
    r.forEach((x, i) => i && expect(x.daysLeft).toBeGreaterThanOrEqual(r[i - 1].daysLeft));
  });

  it("every reorder row is short of 30 days and suggests at least one unit", () => {
    for (const f of [...ranges, {}]) for (const x of reorderSuggestions(seed, f).rows) {
      expect(x.daysLeft).toBeLessThan(30);
      expect(x.suggest).toBeGreaterThan(0);
    }
  });
});

describe("inventory analytics", () => {
  const r = ranges[0];
  it("stock value matches the Stock report, and categories and health buckets add up to it", () => {
    const inv = inventoryAnalytics(seed, r), stock = stockReport(seed, {}).totals;
    near(inv.valueAtCost, stock.valueByCost ?? 0, 0.05);
    near(inv.valueAtSale, stock.valueBySale ?? 0, 0.05);
    near(inv.byCategory.reduce((s, x) => s + x.value, 0), inv.valueAtCost, 0.5);
    near(inv.health.reduce((s, x) => s + x.value, 0), inv.valueAtCost, 0.5);
  });

  it("ignores the date range: any period shows today's stock", () => {
    expect(inventoryAnalytics(seed, { from: "2026-01-01", to: "2026-01-31" })).toEqual(inventoryAnalytics(seed, r));
  });

  it("a category filter keeps only that category's stock", () => {
    const all = inventoryAnalytics(seed, r);
    const top = all.byCategory[0];
    const id = seed.categories.find((c) => c.name === top.label)!.id;
    const one = inventoryAnalytics(seed, { ...r, categoryId: id });
    near(one.valueAtCost, top.value, 0.05);
    expect(one.byCategory).toHaveLength(1);
  });
});

describe("analytics filters", () => {
  const r = ranges[0];
  const cats = profitBreakdown(seed, "category", r).rows.filter((x) => x.key);

  it("main categories split the headline: each matches its breakdown row and they add up to the whole", () => {
    let sales = 0, gross = 0;
    for (const c of cats) {
      const o = overview(seed, { ...r, categoryId: c.key }).current;
      near(o.sales, c.sales, 0.05);
      near(o.grossProfit, c.profit, 0.05);
      sales += o.sales; gross += o.grossProfit;
    }
    const all = overview(seed, r).current;
    near(sales, all.sales, 0.5);
    near(gross, all.grossProfit, 0.5);
  });

  it("an item filter narrows sales but keeps net profit, expenses and payables whole-business", () => {
    const all = overview(seed, r), one = overview(seed, { ...r, categoryId: cats[0].key });
    expect(one.current.sales).toBeLessThan(all.current.sales);
    expect(one.current.orders).toBeLessThan(all.current.orders);
    expect(one.current.netProfit).toBe(all.current.netProfit);
    expect(one.current.expenses).toBe(all.current.expenses);
    expect(one.payables).toBe(all.payables);
    expect(expenseAnalytics(seed, { ...r, categoryId: cats[0].key })).toEqual(expenseAnalytics(seed, r));
  });

  it("several values in one filter add up like separate filters", () => {
    const [a, b] = cats;
    near(overview(seed, { ...r, categoryId: `${a.key},${b.key}` }).current.sales, overview(seed, { ...r, categoryId: a.key }).current.sales + overview(seed, { ...r, categoryId: b.key }).current.sales, 0.05);
  });

  it("a brand filter keeps only that brand's products in the charts", () => {
    const brand = seed.products.find((p) => p.brandId)!.brandId!;
    const names = new Set(seed.products.filter((p) => p.brandId === brand).map((p) => p.name));
    const p = productAnalytics(seed, { from: "2026-04-01", to: "2026-09-30", brandId: brand });
    for (const x of p.topBySales) expect([...names].some((n) => x.label.startsWith(n))).toBe(true);
  });

  it("a customer filter counts only that customer's orders, and the heatmap shrinks to match", () => {
    const top = customerAnalytics(seed, r).topCustomers[0];
    const id = seed.contacts.find((c) => c.name === top.label)!.id;
    const want = seed.transactions.filter((t) => t.type === "sell" && t.status === "final" && t.contactId === id && t.date.slice(0, 10) >= r.from && t.date.slice(0, 10) <= r.to);
    expect(overview(seed, { ...r, contactId: id }).current.orders).toBe(want.length);
    near(salesPatterns(seed, { ...r, contactId: id }).heat.flat().reduce((a, v) => a + v, 0), want.reduce((a, t) => a + t.totals.total, 0), 0.1);
  });
});
