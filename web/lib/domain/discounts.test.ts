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

it("a customer-only rule covers the whole basket, for listed customers only", () => {
  const vip: DiscountRule = { ...base, id: "vip", categoryId: null, contactIds: ["c1"] };
  const ctx = { productId: "p9", categoryId: "c9", locationId: "l1", at: "2026-06-01" };
  expect(findDiscount([vip], { ...ctx, contactId: "c1" })?.id).toBe("vip");
  expect(findDiscount([vip], { ...ctx, contactId: "c2" })).toBeNull();
  expect(findDiscount([vip], ctx)).toBeNull();
  // With an item scope too, both have to match.
  const vipCat: DiscountRule = { ...base, id: "vipCat", contactIds: ["c1"] };
  expect(findDiscount([vipCat], { ...ctx, categoryId: "c1", contactId: "c1" })?.id).toBe("vipCat");
  expect(findDiscount([vipCat], { ...ctx, contactId: "c1" })).toBeNull();
});
