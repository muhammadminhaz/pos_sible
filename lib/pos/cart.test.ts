import { describe, expect, it } from "vitest";
import {
  addItem, emptyCart, exceedsStock, patchCart, removeLine, setContact, setLineDiscount, setPrice, setQty, setSerials,
  type AddItemInput,
} from "./cart";

const rice: AddItemInput = {
  productId: "p1", variationId: "v1", name: "Rice 25kg", sku: "R25", unitId: "u_pc", unitName: "Pc", allowDecimal: false,
  unitPrice: 1500, taxId: null, taxRate: 0, taxType: "exclusive", discount: null, enableSerial: false, maxQty: 3,
};
const feed: AddItemInput = { ...rice, productId: "p2", variationId: "v2", name: "Feed", sku: "F1", allowDecimal: true, maxQty: null };

describe("cart", () => {
  it("adds a new line with qty 1 by default", () => {
    const c = addItem(emptyCart(), rice);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]).toMatchObject({ variationId: "v1", qty: 1, note: "", serials: [] });
  });

  it("re-scanning the same variation increases qty in increase_qty mode", () => {
    const c = addItem(addItem(emptyCart(), rice), rice);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0].qty).toBe(2);
  });

  it("new_row mode always appends", () => {
    const c = addItem(addItem(emptyCart(), rice, "new_row"), rice, "new_row");
    expect(c.lines).toHaveLength(2);
    expect(c.lines[0].key).not.toBe(c.lines[1].key);
  });

  it("setQty rounds integers for non-decimal units and removes nothing at 0", () => {
    let c = addItem(emptyCart(), rice);
    c = setQty(c, c.lines[0].key, 2.6);
    expect(c.lines[0].qty).toBe(3);
    c = setQty(c, c.lines[0].key, 0);
    expect(c.lines[0].qty).toBe(1); // minimum is one unit; removal is explicit
  });

  it("setQty keeps decimals for decimal units", () => {
    let c = addItem(emptyCart(), feed);
    c = setQty(c, c.lines[0].key, 12.5);
    expect(c.lines[0].qty).toBe(12.5);
  });

  it("price, discount, serials and removal", () => {
    let c = addItem(addItem(emptyCart(), rice), feed);
    const k = c.lines[0].key;
    c = setPrice(c, k, 1450);
    c = setLineDiscount(c, k, { type: "percentage", amount: 5 });
    c = setSerials(c, k, [" A1 ", "", "A2"]);
    expect(c.lines[0]).toMatchObject({ unitPrice: 1450, discount: { type: "percentage", amount: 5 }, serials: ["A1", "A2"] });
    c = removeLine(c, k);
    expect(c.lines.map((l) => l.variationId)).toEqual(["v2"]);
  });

  it("changing customer clears redeemed points", () => {
    const c = setContact(patchCart(emptyCart(), { pointsRedeemed: 40 }), "cust_1");
    expect(c).toMatchObject({ contactId: "cust_1", pointsRedeemed: 0 });
  });

  it("exceedsStock respects unmanaged stock", () => {
    const c = addItem(emptyCart(), rice);
    expect(exceedsStock(c.lines[0], 4)).toBe(true);
    expect(exceedsStock(c.lines[0], 3)).toBe(false);
    expect(exceedsStock(addItem(emptyCart(), feed).lines[0], 9999)).toBe(false);
  });

  it("ops never mutate the input", () => {
    const a = addItem(emptyCart(), rice);
    const snapshot = structuredClone(a);
    setQty(a, a.lines[0].key, 2);
    removeLine(a, a.lines[0].key);
    expect(a).toEqual(snapshot);
  });
});

import { applySaleDefaults } from "./cart";

describe("applySaleDefaults", () => {
  it("fills in the default discount and tax only when the cart has none", () => {
    const c = applySaleDefaults(emptyCart(), { defaultDiscount: 5, defaultTaxId: "tax_vat" }, 7.5);
    expect(c.discount).toEqual({ type: "percentage", amount: 5 });
    expect([c.orderTaxId, c.orderTaxRate]).toEqual(["tax_vat", 7.5]);
    const kept = applySaleDefaults({ ...c, discount: { type: "fixed", amount: 10 } }, { defaultDiscount: 5, defaultTaxId: "tax_x" }, 1);
    expect(kept.discount).toEqual({ type: "fixed", amount: 10 });
    expect(kept.orderTaxId).toBe("tax_vat");
  });
  it("does nothing when no defaults are set", () => {
    expect(applySaleDefaults(emptyCart(), { defaultDiscount: 0, defaultTaxId: null }, null)).toEqual(emptyCart());
  });
});
