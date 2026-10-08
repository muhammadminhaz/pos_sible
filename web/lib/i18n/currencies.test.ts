import { describe, expect, it } from "vitest";
import { currencyOptions, currencySymbol } from "./currencies";

describe("currencies", () => {
  it("pairs the symbol with the name", () => {
    expect(currencySymbol("BDT")).toBe("৳");
    const bdt = currencyOptions("en").find((o) => o.value === "BDT")!;
    expect(bdt.label).toBe("৳  Bangladeshi Taka (BDT)");
    expect(bdt.chip).toBe("৳ BDT");
  });
  it("lists the whole world, not a handful", () => {
    expect(currencyOptions("en").length).toBeGreaterThan(100);
  });
});
