import { it, expect } from "vitest";
import { sellPriceFromMargin, marginFromPrices, resolveUnitPrice } from "./pricing";

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
