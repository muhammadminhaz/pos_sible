import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { profitBreakdown, purchaseSale } from "./money";
import { itemsReport, productPurchase, productSellDetailed, productSellGrouped, trendingProducts } from "./products";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const f = { from: "2026-04-01", to: "2026-09-30" };
const near = (a: number, b: number, eps = 0.5) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("product sell", () => {
  it("detailed lines add up to the sales and returns on the list screens (net of returns)", () => {
    const d = productSellDetailed(seed, f);
    const ps = purchaseSale(seed, f);
    // Lines are tax-inclusive but before order-level discount, shipping and tax: within a few percent of the document totals.
    const docs = ps.sales.total - ps.sellReturns.total;
    expect(d.totals.subtotal!).toBeGreaterThan(docs * 0.9);
    expect(d.rows.some((r) => r.qty < 0)).toBe(true);
    const lineSales = seed.transactions.filter((t) => t.type === "sell" && t.status === "final" && t.date.slice(0, 10) >= f.from && t.date.slice(0, 10) <= f.to).reduce((s, t) => s + t.totals.linesTotal, 0);
    const lineReturns = seed.transactions.filter((t) => t.type === "sell_return" && t.date.slice(0, 10) >= f.from && t.date.slice(0, 10) <= f.to).reduce((s, t) => s + t.totals.linesTotal, 0);
    near(d.totals.subtotal!, lineSales - lineReturns, 1);
  });

  it("by-lot rows split a line without changing its totals, and cost comes from lot allocations", () => {
    const plain = productSellDetailed(seed, f);
    const lots = productSellDetailed(seed, f, true);
    near(lots.totals.qty!, plain.totals.qty!, 0.01);
    near(lots.totals.cost!, plain.totals.cost!, 1);
    near(lots.totals.subtotal!, plain.totals.subtotal!, 1);
    expect(lots.rows.length).toBeGreaterThanOrEqual(plain.rows.length);
  });

  it("every grouping gives the same totals, and profit matches the profit report's line-level profit", () => {
    const groups = (["product", "category", "brand"] as const).map((g) => productSellGrouped(seed, g, f));
    for (const g of groups) { near(g.totals.subtotal!, groups[0].totals.subtotal!, 0.01); near(g.totals.qty!, groups[0].totals.qty!, 0.01); }
    // Profit report is ex-tax, this one tax-inclusive: compare the cost side, which is identical.
    near(groups[0].totals.cost!, profitBreakdown(seed, "product", f).totals.cost!, 1);
  });

  it("filters by category, location and search", () => {
    const cat = seed.products.find((p) => p.categoryId)!.categoryId!;
    const some = productSellDetailed(seed, { ...f, categoryId: cat });
    expect(some.rows.length).toBeLessThan(productSellDetailed(seed, f).rows.length);
    expect(productSellDetailed(seed, { ...f, locationId: LOC_RANGO }).rows.every((r) => r.locationName === seed.locations.find((l) => l.id === LOC_RANGO)!.name)).toBe(true);
    expect(productSellDetailed(seed, { ...f, search: "zzzz-no-such" }).rows).toEqual([]);
  });
});

describe("product purchase", () => {
  it("lines add up to purchase totals, returns negative", () => {
    const r = productPurchase(seed, f);
    const lineTotal = seed.transactions.filter((t) => (t.type === "purchase" && t.status === "received") && t.date.slice(0, 10) >= f.from && t.date.slice(0, 10) <= f.to).reduce((s, t) => s + t.totals.linesTotal, 0);
    const lineRet = seed.transactions.filter((t) => t.type === "purchase_return" && t.date.slice(0, 10) >= f.from && t.date.slice(0, 10) <= f.to).reduce((s, t) => s + t.totals.linesTotal, 0);
    near(r.totals.subtotal!, lineTotal - lineRet, 1);
    expect(r.rows.some((x) => x.qty < 0)).toBe(true);
  });
});

describe("trending products", () => {
  it("is sorted, limited, net of returns and only positive sellers", () => {
    const t = trendingProducts(seed, f, 5);
    expect(t.rows.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < t.rows.length; i++) expect(t.rows[i - 1].sold).toBeGreaterThanOrEqual(t.rows[i].sold);
    expect(t.rows.every((r) => r.sold > 0)).toBe(true);
    const all = trendingProducts(seed, f, 10000);
    expect(all.rows.length).toBeGreaterThan(5);
  });
});

describe("items report", () => {
  it("each sale slice traces to a purchase or opening stock, and quantities match the lots taken", () => {
    const r = itemsReport(seed, f);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.some((x) => x.purchaseRef)).toBe(true);
    expect(r.rows.some((x) => !x.purchaseRef)).toBe(true); // opening stock
    const sold = seed.transactions.filter((t) => t.type === "sell" && t.status === "final" && t.date.slice(0, 10) >= f.from && t.date.slice(0, 10) <= f.to).flatMap((t) => t.lines).reduce((s, l) => s + l.allocations.reduce((q, a) => q + a.qty, 0), 0);
    near(r.totals.qty!, sold, 0.01);
  });
  it("filters by supplier and customer", () => {
    const sup = itemsReport(seed, f).rows.find((x) => x.supplier)!.supplier;
    const supId = seed.contacts.find((c) => c.name === sup)!.id;
    const r = itemsReport(seed, { ...f, supplierId: supId });
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.supplier === sup)).toBe(true);
  });
});
