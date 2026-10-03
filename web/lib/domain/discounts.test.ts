import { it, expect } from "vitest";
import { findDiscount, type DiscountRule } from "./discounts";

const base: DiscountRule = {
  id: "a", name: "A", active: true, locationId: null, productIds: [], brandId: null, categoryId: "c1",
  priority: 1, type: "percentage", amount: 5, startsAt: "2026-01-01", endsAt: "2026-12-31",
};

it("picks highest priority matching rule", () => {
  const rules = [base, { ...base, id: "b", priority: 5, productIds: ["p1"], categoryId: null }];
  expect(findDiscount(rules, { productId: "p1", categoryId: "c1", locationId: "l1", at: "2026-06-01" })?.id).toBe("b");
  expect(findDiscount(rules, { productId: "p2", categoryId: "c1", locationId: "l1", at: "2026-06-01" })?.id).toBe("a");
  expect(findDiscount(rules, { productId: "p2", categoryId: "c9", locationId: "l1", at: "2026-06-01" })).toBeNull();
  expect(
    findDiscount([{ ...base, endsAt: "2026-02-01" }], { productId: "p2", categoryId: "c1", locationId: "l1", at: "2026-06-01" }),
  ).toBeNull();
});
