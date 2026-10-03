import { describe, expect, it } from "vitest";
import { denominationTotal } from "./Denominations";

describe("denominationTotal", () => {
  it("sums note value times count", () => {
    expect(denominationTotal({ "500": 2, "100": 3 })).toBe(1300);
  });
  it("treats a missing or empty count as zero", () => {
    expect(denominationTotal({})).toBe(0);
    expect(denominationTotal({ "500": 0 })).toBe(0);
  });
  it("rounds the total", () => {
    expect(denominationTotal({ "0.1": 3 })).toBeCloseTo(0.3);
  });
});
