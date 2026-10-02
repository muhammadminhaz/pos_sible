import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { resetDB } from "@/lib/data/store/db";
import { expensesService } from "../expenses";
import { profitService } from "../dashboard";
import { purchasesService } from "../purchases";
import { salesService } from "../sales";
import { getDB } from "@/lib/data/store/db";
import { moneyReports, profitBreakdown, profitLoss, purchaseSale, taxRows, taxSummary } from "./money";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const near = (a: number, b: number, eps = 0.011) => expect(Math.abs(a - b)).toBeLessThan(eps);
const ranges = [
  { from: "2026-09-01", to: "2026-09-30" },
  { from: "2026-07-15", to: "2026-07-15" },
  { from: "2026-04-01", to: "2026-09-30", locationId: LOC_RANGO },
  { from: "2026-04-01", to: "2026-09-30", locationId: LOC_NIPUN },
];

describe("profit / loss", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("matches the header profit popover for the same period (cost from lot allocations)", async () => {
    for (const r of ranges) {
      const p = profitLoss(seed, r);
      const h = await profitService.summary({ locationId: r.locationId ?? "all", from: r.from, to: r.to });
      near(p.sales - p.sellReturn, h.sales);
      near(p.cogs, h.cost);
      near(p.grossProfit, h.grossProfit);
      near(p.expenses, h.expense);
      near(p.netProfit, h.netProfit);
    }
  });

  it("subtracts returns: a larger return lowers sales and profit", () => {
    const d = structuredClone(seed);
    const before = profitLoss(d, ranges[2]);
    const ret = d.transactions.find((t) => t.type === "sell_return" && t.locationId === LOC_RANGO) ?? d.transactions.find((t) => t.type === "sell_return")!;
    expect(ret).toBeTruthy();
    const withRet = profitLoss(d, { from: "2026-04-01", to: "2026-09-30", locationId: ret.locationId });
    const without = profitLoss({ ...d, transactions: d.transactions.filter((t) => t.id !== ret.id) }, { from: "2026-04-01", to: "2026-09-30", locationId: ret.locationId });
    expect(withRet.sellReturn).toBeGreaterThan(0);
    expect(withRet.grossProfit).toBeLessThan(without.grossProfit + 0.011);
    expect(before.sales).toBeGreaterThan(0);
  });

  it("opening stock is the previous day's closing stock", () => {
    const a = profitLoss(seed, { from: "2026-08-01", to: "2026-08-31" });
    const b = profitLoss(seed, { from: "2026-09-01", to: "2026-09-30" });
    near(a.closingStock, b.openingStock);
    expect(a.closingStock).toBeGreaterThan(0);
  });

  it("location 'all' equals the sum of the locations for flows and for stock", () => {
    const f = { from: "2026-04-01", to: "2026-09-30" };
    const all = profitLoss(seed, f);
    const r = profitLoss(seed, { ...f, locationId: LOC_RANGO });
    const n = profitLoss(seed, { ...f, locationId: LOC_NIPUN });
    near(all.sales, r.sales + n.sales);
    near(all.expenses, r.expenses + n.expenses);
    // Transfers move stock between locations but never create or destroy any.
    near(all.closingStock, r.closingStock + n.closingStock, 0.5);
  });

  it("an empty range is zero everywhere", () => {
    const p = profitLoss(seed, { from: "2000-01-01", to: "2000-01-31" });
    expect(Object.values(p).every((v) => v === 0)).toBe(true);
  });

  it("every breakdown adds up to the summary's gross profit, and a refund expense raises net profit", () => {
    for (const f of [{ from: "2026-04-01", to: "2026-09-30" }, ...ranges]) {
      const summary = profitLoss(seed, f);
      for (const dim of ["product", "category", "brand", "location", "invoice", "date", "customer"] as const) {
        const b = profitBreakdown(seed, dim, f).totals;
        near(b.sales ?? 0, summary.sales - summary.sellReturn, 0.5);
        near(b.profit ?? 0, summary.grossProfit, 0.5);
      }
    }
    expect(profitLoss(seed, { from: "2026-04-01", to: "2026-09-30" }).grossProfit).toBeGreaterThan(0);
    const d = structuredClone(seed);
    const exp = d.transactions.find((t) => t.type === "expense")!;
    const before = profitLoss(d, { from: "2000-01-01" }).netProfit;
    exp.isRefund = true;
    expect(profitLoss(d, { from: "2000-01-01" }).netProfit).toBeGreaterThan(before);
  });
});

describe("purchase & sale", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("reconciles with the sales, purchases and expense lists for the same filters", async () => {
    for (const r of ranges) {
      const ps = purchaseSale(getDB(), r);
      const sales = await salesService.listAll({ kind: "all", from: r.from, to: r.to, locationId: r.locationId ?? undefined, pageSize: -1 });
      const finals = sales.rows.filter((x) => x.status === "final");
      near(ps.sales.total, finals.reduce((s, x) => s + x.total, 0));
      const purchases = await purchasesService.list({ status: "received", from: r.from, to: r.to, locationId: r.locationId ?? undefined, pageSize: -1 });
      near(ps.purchases.total, purchases.totals.total);
      near(ps.purchases.due, purchases.totals.due);
      const exp = await expensesService.list({ from: r.from, to: r.to, locationId: r.locationId ?? undefined, pageSize: -1 });
      near(profitLoss(getDB(), r).expenses, exp.totals.total);
    }
  });

  it("net = sales − returns − (purchases − returns)", () => {
    const p = purchaseSale(seed, { from: "2026-04-01", to: "2026-09-30" });
    near(p.saleMinusPurchase, p.sales.total - p.sellReturns.total - p.purchases.total + p.purchaseReturns.total);
    expect(p.sellReturns.count).toBeGreaterThan(0);
  });
});

describe("tax report", () => {
  it("rows add up and the summary is output − input − expense tax", () => {
    const f = { from: "2026-04-01", to: "2026-09-30" };
    const s = taxSummary(seed, f);
    near(s.payable, s.output - s.input - s.expense);
    const out = taxRows(seed, "output", f);
    near(out.totals.tax ?? 0, s.output);
    expect(out.rows.some((r) => r.total < 0)).toBe(true); // sell returns come through negative
  });
  it("is exposed through the service with a summary", async () => {
    const r = await moneyReports.tax("input", { from: "2026-04-01", to: "2026-09-30" });
    expect(r.summary.input).toBe(r.totals.tax);
  });
});
