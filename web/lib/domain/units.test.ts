import { it, expect } from "vitest";
import { toBaseQty } from "./units";

it("converts sub unit", () => {
  expect(toBaseQty(2, { id: "bag", baseUnitId: "kg", multiplier: 50 })).toBe(100);
  expect(toBaseQty(3, { id: "pc" })).toBe(3);
});
