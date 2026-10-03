import { describe, expect, it } from "vitest";
import { exportFileName } from "./export";

const at = new Date(2026, 9, 3, 14, 5);

describe("exportFileName", () => {
  it("says business, what, date and time", () => {
    expect(exportFileName("sales", "Acme Traders", at)).toBe("acme-traders_sales_2026-10-03_14-05");
  });
  it("turns camelCase table names and unsafe characters into dashes", () => {
    expect(exportFileName("taxRates", "Sosa's Shop / Dhaka", at)).toBe("sosa-s-shop-dhaka_tax-rates_2026-10-03_14-05");
    expect(exportFileName("account-book-Cash: Main?", undefined, at)).toBe("account-book-cash-main_2026-10-03_14-05");
  });
  it("keeps non-Latin business names (Bangla)", () => {
    expect(exportFileName("customers", "সোসা স্টোর", at)).toContain("_customers_");
    expect(exportFileName("customers", "সোসা স্টোর", at).startsWith("_")).toBe(false);
  });
});
