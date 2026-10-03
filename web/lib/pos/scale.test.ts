import { describe, expect, it } from "vitest";
import { parseScaleBarcode } from "./scale";

const s = { prefix: "21", skuLength: 5, qtyLength: 3, qtyDecimalLength: 2 };

describe("parseScaleBarcode", () => {
  it("splits prefix, sku, integer and decimal quantity", () => {
    expect(parseScaleBarcode("21" + "00123" + "012" + "50", s)).toEqual({ sku: "00123", qty: 12.5 });
  });
  it("ignores a trailing check digit", () => {
    expect(parseScaleBarcode("2100123001257", s)).toEqual({ sku: "00123", qty: 1.25 });
  });
  it("rejects wrong prefix, short codes and non-digit quantities", () => {
    expect(parseScaleBarcode("2200123001250", s)).toBeNull();
    expect(parseScaleBarcode("21001230", s)).toBeNull();
    expect(parseScaleBarcode("2100123abc50", s)).toBeNull();
  });
  it("an empty prefix never matches (feature needs a prefix)", () => {
    expect(parseScaleBarcode("0012301250", { ...s, prefix: "" })).toBeNull();
  });
});
