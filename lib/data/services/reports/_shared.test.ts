import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { groupSum, inScope, isFinalSale, isReceivedPurchase, lineCostOf, lineTax, sumBy, userLabel } from "./_shared";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("inScope", () => {
  const t = { date: "2026-09-10T23:59:59", locationId: LOC_RANGO };
  it("includes both end days", () => {
    expect(inScope(t, { from: "2026-09-10", to: "2026-09-10" })).toBe(true);
    expect(inScope({ ...t, date: "2026-09-10T00:00:00" }, { from: "2026-09-10", to: "2026-09-10" })).toBe(true);
    expect(inScope(t, { from: "2026-09-11" })).toBe(false);
    expect(inScope(t, { to: "2026-09-09" })).toBe(false);
  });
  it("treats a missing or null location as all locations", () => {
    expect(inScope(t, {})).toBe(true);
    expect(inScope(t, { locationId: null })).toBe(true);
    expect(inScope(t, { locationId: LOC_NIPUN })).toBe(false);
    expect(inScope(t, { locationId: LOC_RANGO })).toBe(true);
  });
});

describe("line helpers", () => {
  it("lineCostOf uses lot allocations, not the current purchase price", () => {
    const l = { qty: 3, unitCost: 999, allocations: [{ lotId: "a", qty: 1, unitCost: 10 }, { lotId: "b", qty: 2, unitCost: 20 }] };
    expect(lineCostOf(l)).toBe(50);
    expect(lineCostOf({ qty: 2, unitCost: 7, allocations: [] })).toBe(14);
  });
  it("lineTax takes the tax out of a tax-inclusive subtotal", () => {
    expect(lineTax({ subtotal: 115, taxRate: 15 })).toBe(15);
    expect(lineTax({ subtotal: 100, taxRate: 0 })).toBe(0);
  });
});

describe("sums", () => {
  it("sumBy rounds money and groupSum keeps first-seen keys", () => {
    expect(sumBy([{ n: 0.1 }, { n: 0.2 }], (r) => r.n)).toBe(0.3);
    const g = groupSum([{ k: "a", n: 1 }, { k: "b", n: 2 }, { k: "a", n: 3 }], (r) => r.k, (r) => r.n);
    expect([...g.entries()]).toEqual([["a", 4], ["b", 2]]);
  });
  it("userLabel handles missing users", () => {
    expect(userLabel(seed.users, null)).toBe("");
    expect(userLabel(seed.users, seed.users[0].id)).toBeTruthy();
  });
  it("final sale / received purchase predicates ignore drafts and pending orders", () => {
    expect(seed.transactions.filter(isFinalSale).every((t) => t.type === "sell" && t.status === "final")).toBe(true);
    expect(seed.transactions.some((t) => t.type === "sell" && t.status === "draft")).toBe(true);
    expect(seed.transactions.filter(isFinalSale).length).toBeLessThan(seed.transactions.filter((t) => t.type === "sell").length);
    expect(seed.transactions.filter(isReceivedPurchase).every((t) => t.status === "received")).toBe(true);
  });
});
