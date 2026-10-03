import { describe, it, expect } from "vitest";
import { paymentSummary, paymentStatus } from "./payments";

describe("payments", () => {
  it("summary with change", () => {
    expect(paymentSummary(95, [{ amount: 100 }])).toEqual({ paid: 100, due: 0, change: 5 });
  });
  it("status", () => {
    expect(paymentStatus({ total: 100, paid: 100, date: "2026-01-01" })).toBe("paid");
    expect(paymentStatus({ total: 100, paid: 40, date: "2026-01-01" })).toBe("partial");
    expect(paymentStatus({ total: 100, paid: 0, date: "2026-01-01" })).toBe("due");
    expect(
      paymentStatus({ total: 100, paid: 0, date: "2026-01-01", payTerm: { number: 10, type: "days" }, today: "2026-02-01" }),
    ).toBe("overdue");
  });
});
