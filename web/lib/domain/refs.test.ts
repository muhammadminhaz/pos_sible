import { it, expect } from "vitest";
import { nextRef, nextInvoiceNo } from "./refs";

it("refs", () => {
  expect(nextRef("PO", 2026, 7)).toBe("PO2026/0007");
  expect(nextInvoiceNo({ prefix: "INV-", startFrom: 1, count: 41, digits: 5, numberingType: "sequential" })).toBe("INV-00042");
  expect(nextInvoiceNo({ prefix: "R", startFrom: 1, count: 0, digits: 4, numberingType: "random" }, () => 0.5)).toMatch(/^R\d{4}$/);
});
