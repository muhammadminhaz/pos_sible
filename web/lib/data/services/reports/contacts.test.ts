import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { customerGroupsReport, contactsReport } from "./contacts";
import { purchaseSale } from "./money";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const f = { from: "2026-04-01", to: "2026-09-30" };
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.011);

describe("contacts report", () => {
  it("customer sales + supplier purchases reconcile with purchase & sale totals", () => {
    const all = contactsReport(seed, f);
    const ps = purchaseSale(seed, f);
    // The walk-in customer has its own row, so nothing is left out.
    near(all.totals.totalSale!, ps.sales.total);
    near(all.totals.totalPurchase!, ps.purchases.total);
    near(all.totals.purchaseReturn!, ps.purchaseReturns.total);
  });

  it("returns are reported next to their totals and customers/suppliers can be told apart", () => {
    const c = contactsReport(seed, { ...f, type: "customer" });
    const s = contactsReport(seed, { ...f, type: "supplier" });
    expect(c.rows.every((r) => r.type !== "supplier")).toBe(true);
    expect(s.rows.every((r) => r.type !== "customer")).toBe(true);
    expect(c.totals.sellReturn!).toBeGreaterThan(0);
  });

  it("respects the location filter", () => {
    const loc = contactsReport(seed, { ...f, locationId: LOC_RANGO });
    near(loc.totals.totalPurchase!, purchaseSale(seed, { ...f, locationId: LOC_RANGO }).purchases.total);
  });

  it("an empty range has no rows", () => {
    expect(contactsReport(seed, { from: "2000-01-01", to: "2000-01-02" }).rows).toEqual([]);
  });
});

describe("customer groups report", () => {
  it("group sales add up to named-customer sales and net = sales − returns", () => {
    const g = customerGroupsReport(seed, f);
    near(g.totals.sales!, purchaseSale(seed, f).sales.total);
    for (const r of g.rows) near(r.net, r.sales - r.sellReturn);
  });
});
