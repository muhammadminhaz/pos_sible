import { describe, expect, it } from "vitest";
import { addItem, emptyCart, patchCart, type AddItemInput } from "./cart";
import { cartTotals, paymentState } from "./selectors";

const rewards = {
  enabled: true, amountForUnitPoint: 100, minOrderTotalToEarn: 0, maxPointsPerOrder: null,
  redeemAmountPerPoint: 1, minOrderTotalToRedeem: 0, minRedeemPoint: 0, maxRedeemPoint: null,
};
const item = (over: Partial<AddItemInput> = {}): AddItemInput => ({
  productId: "p", variationId: "v", name: "X", sku: "X", unitId: "u", unitName: "Pc", allowDecimal: false,
  unitPrice: 100, taxId: null, taxRate: 0, taxType: "exclusive", discount: null, enableSerial: false, maxQty: null, ...over,
});

describe("cartTotals", () => {
  it("sums exclusive and inclusive lines", () => {
    let c = addItem(emptyCart(), item({ qty: 2 }));
    c = addItem(c, item({ variationId: "v2", unitPrice: 115, taxRate: 15, taxType: "inclusive" }));
    const t = cartTotals(c, { rounding: "none", rewards });
    expect(t.lines.map((l) => l.subtotal)).toEqual([200, 115]);
    expect(t).toMatchObject({ itemsCount: 3, linesTotal: 315, total: 315 });
  });

  it("applies order discount, order tax, shipping, redeemed points and rounding", () => {
    let c = addItem(emptyCart(), item({ unitPrice: 1000.4 }));
    c = patchCart(c, {
      discount: { type: "percentage", amount: 10 }, orderTaxRate: 5,
      shipping: { zone: "inside_dhaka", charges: 60, details: "", address: "" }, pointsRedeemed: 20,
    });
    const t = cartTotals(c, { rounding: "whole", rewards });
    // 1000.40 − 100.04 = 900.36; tax 45.02; +60 −20 = 985.38 → 985
    expect(t).toMatchObject({ discount: 100.04, orderTax: 45.02, shipping: 60, redeemed: 20, total: 985, roundOff: -0.38 });
  });
});

describe("paymentState", () => {
  it("exact payment", () => {
    expect(paymentState(500, [{ method: "cash", amount: 500 }])).toEqual({ paid: 500, change: 0, shortfall: 0, nonCashOverpaid: false });
  });
  it("cash overpayment becomes change", () => {
    expect(paymentState(480, [{ method: "custom_pay_1", amount: 300 }, { method: "cash", amount: 200 }])).toMatchObject({ change: 20, shortfall: 0 });
  });
  it("shortfall when underpaid", () => {
    expect(paymentState(500, [{ method: "card", amount: 200 }])).toMatchObject({ paid: 200, shortfall: 300 });
  });
  it("flags non-cash overpayment", () => {
    expect(paymentState(500, [{ method: "card", amount: 600 }]).nonCashOverpaid).toBe(true);
    expect(paymentState(500, [{ method: "card", amount: 450 }, { method: "cash", amount: 100 }]).nonCashOverpaid).toBe(false);
  });
});
