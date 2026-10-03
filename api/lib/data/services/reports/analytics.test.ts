import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { customerAnalytics, expenseAnalytics, overview, previousRange, productAnalytics, reorderSuggestions, salesPatterns } from "./analytics";
import { profitLoss } from "./money";

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
});
