import { describe, it, expect } from "vitest";
import { roundMoney, applyRounding } from "./money";
import { lineTotals, orderTotals } from "./totals";

describe("money", () => {
  it("rounds half up", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.344)).toBe(2.34);
  });
  it("rounding modes", () => {
    expect(applyRounding(10.37, "whole")).toEqual({ total: 10, roundOff: -0.37 });
    expect(applyRounding(10.37, "0.05")).toEqual({ total: 10.35, roundOff: -0.02 });
    expect(applyRounding(10.37, "0.5")).toEqual({ total: 10.5, roundOff: 0.13 });
    expect(applyRounding(10.37, "none")).toEqual({ total: 10.37, roundOff: 0 });
  });
});

describe("lineTotals", () => {
  it("exclusive tax", () => {
    const t = lineTotals({ qty: 2, unitPrice: 100, taxRate: 5, taxType: "exclusive" });
    expect(t).toMatchObject({ unitExc: 100, unitTax: 5, unitInc: 105, subtotal: 210, tax: 10 });
  });
  it("inclusive tax back-calculates", () => {
    const t = lineTotals({ qty: 1, unitPrice: 105, taxRate: 5, taxType: "inclusive" });
    expect(t.unitExc).toBe(100);
    expect(t.subtotal).toBe(105);
  });
  it("percentage line discount on exc price", () => {
    const t = lineTotals({
      qty: 1, unitPrice: 200, taxRate: 0, taxType: "exclusive",
      discount: { type: "percentage", amount: 10 },
    });
    expect(t.subtotal).toBe(180);
  });
});

describe("orderTotals", () => {
  it("combines discount, tax, shipping, rounding", () => {
    const o = orderTotals({
      lines: [{ qty: 3, unitPrice: 33.33, taxRate: 0, taxType: "exclusive" }],
      discount: { type: "fixed", amount: 10 },
      orderTaxRate: 5,
      shipping: 60,
      additionalExpenses: [5],
      rounding: "whole",
    });
    // lines 99.99, -10 = 89.99, tax 4.50, +60 +5 = 159.49 → 159
    expect(o).toMatchObject({ linesTotal: 99.99, discount: 10, orderTax: 4.5, total: 159, roundOff: -0.49, itemsCount: 3 });
  });
});
