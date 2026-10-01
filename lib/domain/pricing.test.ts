import { describe, it, expect } from "vitest";
import { sellPriceFromMargin, marginFromPrices, recalcPrices, resolveUnitPrice, type PriceSet } from "./pricing";

it("margin", () => {
  expect(sellPriceFromMargin(100, 25)).toBe(125);
  expect(marginFromPrices(80, 100)).toBe(25);
});

it("price groups", () => {
  expect(resolveUnitPrice({ defaultPrice: 100, groupPrices: { w: 90 }, priceGroupId: "w" })).toBe(90);
  expect(resolveUnitPrice({ defaultPrice: 100, customerGroup: { calcType: "percentage", amount: -5 } })).toBe(95);
  expect(
    resolveUnitPrice({
      defaultPrice: 100, groupPrices: { d: 80 },
      customerGroup: { calcType: "selling_price_group", amount: 0, priceGroupId: "d" },
    }),
  ).toBe(80);
});

describe("recalcPrices", () => {
  const base: PriceSet = { purchasePriceExc: 100, purchasePriceInc: 105, margin: 20, sellPriceExc: 120, sellPriceInc: 126 };
  it("a new purchase price keeps the margin and moves the selling price", () => {
    const r = recalcPrices({ ...base, purchasePriceExc: 200 }, "purchasePriceExc", 5);
    expect(r).toMatchObject({ purchasePriceInc: 210, margin: 20, sellPriceExc: 240, sellPriceInc: 252 });
  });
  it("a purchase price including tax is converted back to excluding tax", () => {
    expect(recalcPrices({ ...base, purchasePriceInc: 210 }, "purchasePriceInc", 5).purchasePriceExc).toBe(200);
  });
  it("a new margin moves both selling prices", () => {
    expect(recalcPrices({ ...base, margin: 50 }, "margin", 5)).toMatchObject({ sellPriceExc: 150, sellPriceInc: 157.5 });
  });
  it("a selling price excluding tax moves the margin and the inclusive price", () => {
    expect(recalcPrices({ ...base, sellPriceExc: 150 }, "sellPriceExc", 5)).toMatchObject({ margin: 50, sellPriceInc: 157.5 });
  });
  it("a selling price including tax round-trips to 2 dp", () => {
    const r = recalcPrices(base, "sellPriceInc", 7.5);
    expect(r.sellPriceExc).toBe(117.21);
    expect(r.margin).toBe(17.21);
  });
  it("zero purchase price gives zero margin instead of NaN", () => {
    expect(recalcPrices({ ...base, purchasePriceExc: 0 }, "sellPriceExc", 0).margin).toBe(0);
  });
});
