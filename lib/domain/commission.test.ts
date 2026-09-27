import { it, expect } from "vitest";
import { commission } from "./commission";

it("commission", () => {
  expect(commission({ percent: 2, basis: "invoice_value", invoiceTotal: 1000, paid: 500 })).toBe(20);
  expect(commission({ percent: 2, basis: "payment_received", invoiceTotal: 1000, paid: 500 })).toBe(10);
});
