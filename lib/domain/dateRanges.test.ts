import { describe, expect, it } from "vitest";
import { presetRange } from "./dateRanges";

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
});
