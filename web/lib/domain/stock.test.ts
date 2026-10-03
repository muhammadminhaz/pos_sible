import { describe, it, expect } from "vitest";
import { allocate, available, expiryState, type Lot } from "./stock";

const lots: Lot[] = [
  { id: "a", locationId: "l1", variationId: "v", qtyRemaining: 5, unitCost: 10, receivedAt: "2026-01-01" },
  { id: "b", locationId: "l1", variationId: "v", qtyRemaining: 5, unitCost: 12, receivedAt: "2026-02-01" },
  { id: "c", locationId: "l2", variationId: "v", qtyRemaining: 9, unitCost: 11, receivedAt: "2026-01-15" },
];

describe("stock", () => {
  it("fifo", () => {
    const r = allocate(lots, { variationId: "v", locationId: "l1", qty: 7, method: "fifo" });
    expect(r.allocations).toEqual([{ lotId: "a", qty: 5, unitCost: 10 }, { lotId: "b", qty: 2, unitCost: 12 }]);
    expect(r.cost).toBe(74);
    expect(r.shortfall).toBe(0);
  });
  it("lifo", () => {
    expect(allocate(lots, { variationId: "v", locationId: "l1", qty: 7, method: "lifo" }).cost).toBe(80);
  });
  it("shortfall", () => {
    expect(allocate(lots, { variationId: "v", locationId: "l1", qty: 12, method: "fifo" }).shortfall).toBe(2);
  });
  it("oversell", () => {
    const r = allocate(lots, { variationId: "v", locationId: "l1", qty: 12, method: "fifo", allowOverselling: true });
    expect(r.shortfall).toBe(0);
    expect(r.allocations.at(-1)).toEqual({ lotId: "oversell", qty: 2, unitCost: 12 });
  });
  it("available", () => {
    expect(available(lots, "v", "l1")).toBe(10);
    expect(available(lots, "v")).toBe(19);
  });
  it("expiry", () => {
    expect(expiryState("2026-01-01", "2026-02-01", 30)).toBe("expired");
    expect(expiryState("2026-02-10", "2026-02-01", 30)).toBe("expiring");
    expect(expiryState("2026-06-10", "2026-02-01", 30)).toBe("ok");
    expect(expiryState(null, "2026-02-01", 30)).toBe("none");
  });
});
