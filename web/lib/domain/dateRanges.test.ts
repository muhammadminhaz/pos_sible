import { describe, expect, it } from "vitest";
import { presetRange, previousRange } from "./dateRanges";

describe("presetRange", () => {
  it("covers the calendar month", () => {
    expect(presetRange("thisMonth", "2026-09-27", 1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("lastMonth", "2026-03-10", 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetRange("lastMonth", "2026-01-10", 1)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("follows the financial year start month", () => {
    expect(presetRange("thisFY", "2026-09-27", 7)).toEqual({ from: "2026-07-01", to: "2027-06-30" });
    expect(presetRange("lastFY", "2026-03-10", 7)).toEqual({ from: "2024-07-01", to: "2025-06-30" });
    expect(presetRange("thisFY", "2026-09-27", 1)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("handles rolling day windows", () => {
    expect(presetRange("today", "2026-09-27", 1)).toEqual({ from: "2026-09-27", to: "2026-09-27" });
    expect(presetRange("yesterday", "2026-03-01", 1)).toEqual({ from: "2026-02-28", to: "2026-02-28" });
    expect(presetRange("last7", "2026-09-27", 1)).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(presetRange("last30", "2026-09-27", 1)).toEqual({ from: "2026-08-29", to: "2026-09-27" });
  });

  it("spans whole calendar months for the last N months", () => {
    expect(presetRange("last3Months", "2026-10-03", 1)).toEqual({ from: "2026-08-01", to: "2026-10-03" });
    expect(presetRange("last6Months", "2026-03-15", 1)).toEqual({ from: "2025-10-01", to: "2026-03-15" });
    expect(presetRange("last12Months", "2026-10-03", 1)).toEqual({ from: "2025-11-01", to: "2026-10-03" });
  });
});

describe("previousRange", () => {
  it("is the same number of days directly before the range", () => {
    expect(previousRange({ from: "2026-09-01", to: "2026-09-30" })).toEqual({ from: "2026-08-02", to: "2026-08-31" });
    expect(previousRange({ from: "2026-09-27", to: "2026-09-27" })).toEqual({ from: "2026-09-26", to: "2026-09-26" });
    expect(previousRange({ from: "2026-03-01", to: "2026-03-07" })).toEqual({ from: "2026-02-22", to: "2026-02-28" });
  });
});
