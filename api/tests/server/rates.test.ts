import { describe, expect, it } from "vitest";
import { canConvert, convert, parseFeed } from "@/lib/server/rates";

const rates = { perUsd: new Map([["USD", 1], ["BDT", 120], ["EUR", 0.9]]) };

describe("currency conversion", () => {
  it("converts through USD and rounds to 2 decimals", () => {
    expect(convert(1200, "BDT", "USD", rates)).toBe(10);
    expect(convert(10, "USD", "EUR", rates)).toBe(9);
    expect(convert(1000, "BDT", "EUR", rates)).toBe(7.5);
    expect(convert(100, "BDT", "EUR", rates)).toBe(0.75);
    expect(convert(1, "BDT", "USD", rates)).toBe(0.01);
  });
  it("leaves the amount alone for the same currency or a missing rate", () => {
    expect(convert(12.345, "BDT", "BDT", rates)).toBe(12.35);
    expect(convert(500, "BDT", "JPY", rates)).toBe(500);
    expect(canConvert("BDT", "JPY", rates)).toBe(false);
    expect(canConvert("BDT", "EUR", rates)).toBe(true);
  });
  it("keeps only usable rates from the feed", () => {
    const got = parseFeed({ result: "success", rates: { USD: 1, BDT: 120.5, bad: 3, ZZZ: -1, NAN: "x", EUR: 0.9 } });
    expect([...got.keys()].sort()).toEqual(["BDT", "EUR", "USD"]);
    expect(parseFeed({ result: "error" }).size).toBe(0);
    expect(parseFeed(null).size).toBe(0);
  });
});
