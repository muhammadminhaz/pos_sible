import { describe, it, expect } from "vitest";
import { pointsEarned, maxRedeemable, redeemValue, isValidRedeem, reservedPoints, type RewardSettings } from "./rewards";

const s: RewardSettings = {
  enabled: true, amountForUnitPoint: 100, minOrderTotalToEarn: 200, maxPointsPerOrder: 20,
  redeemAmountPerPoint: 1, minOrderTotalToRedeem: 100, minRedeemPoint: 10, maxRedeemPoint: 50,
};

it("rewards", () => {
  expect(pointsEarned(150, s)).toBe(0);
  expect(pointsEarned(950, s)).toBe(9);
  expect(pointsEarned(5000, s)).toBe(20);
  expect(maxRedeemable({ total: 500, balance: 80, s })).toBe(50);
  expect(maxRedeemable({ total: 500, balance: 5, s })).toBe(0);
  expect(redeemValue(30, s)).toBe(30);
});

it("a redemption below the minimum is rejected, zero is always fine", () => {
  expect(isValidRedeem(0, 50, s)).toBe(true);
  expect(isValidRedeem(5, 50, s)).toBe(false);
  expect(isValidRedeem(10, 50, s)).toBe(true);
  expect(isValidRedeem(51, 50, s)).toBe(false);
});

it("points held by a customer's other suspended sales are reserved", () => {
  const t = (id: string, status: string, pts: number, contactId = "c1") => ({ id, type: "sell", status, contactId, pointsRedeemed: pts });
  const txns = [t("a", "suspended", 30), t("b", "suspended", 20), t("c", "final", 99), t("d", "suspended", 5, "c2")];
  expect(reservedPoints(txns, "c1")).toBe(50);
  expect(reservedPoints(txns, "c1", "a")).toBe(20);
});

import { pointsPosition } from "./rewards";

describe("points expiry", () => {
  const base = { expiryPeriod: 6, expiryType: "month" as const, today: "2026-10-02" };
  it("lets points live for the whole period, then lapses them", () => {
    const events = [{ date: "2026-05-01T10:00:00", earned: 100, redeemed: 0 }, { date: "2026-08-01T10:00:00", earned: 50, redeemed: 0 }];
    expect(pointsPosition({ ...base, stored: 150, events })).toEqual({ available: 150, expired: 0, expiring: { points: 100, on: "2026-11-01" } });
    expect(pointsPosition({ ...base, stored: 150, events, today: "2026-11-01" })).toMatchObject({ available: 50, expired: 100, expiring: null });
    expect(pointsPosition({ ...base, stored: 150, events, today: "2027-02-01" })).toMatchObject({ available: 0, expired: 150 });
  });
  it("spends the oldest points first, so redeeming saves newer points from the same fate", () => {
    const events = [
      { date: "2026-01-10T10:00:00", earned: 100, redeemed: 0 },
      { date: "2026-03-10T10:00:00", earned: 100, redeemed: 0 },
      { date: "2026-04-10T10:00:00", earned: 0, redeemed: 100 },
    ];
    // The first 100 were spent in April, so only the March batch is left and it lapses in September.
    expect(pointsPosition({ ...base, stored: 100, events, today: "2026-08-01" })).toMatchObject({ available: 100, expired: 0 });
    expect(pointsPosition({ ...base, stored: 100, events, today: "2026-09-11" })).toMatchObject({ available: 0, expired: 100 });
  });
  it("does not use points that had already lapsed when a later sale happened", () => {
    const events = [{ date: "2026-01-01T00:00:00", earned: 100, redeemed: 0 }, { date: "2026-06-01T00:00:00", earned: 40, redeemed: 0 }, { date: "2026-08-01T00:00:00", earned: 0, redeemed: 30 }];
    // January's batch lapsed on 1 July, so the August redemption came out of June's batch.
    expect(pointsPosition({ ...base, stored: 110, events, today: "2026-08-15" })).toMatchObject({ available: 10, expired: 100 });
  });
  it("never expires a balance the history doesn't explain, and does nothing when expiry is off", () => {
    expect(pointsPosition({ ...base, stored: 80, events: [], today: "2030-01-01" })).toMatchObject({ available: 80, expired: 0 });
    expect(pointsPosition({ ...base, expiryPeriod: null, stored: 90, events: [{ date: "2020-01-01", earned: 90, redeemed: 0 }] })).toEqual({ available: 90, expired: 0, expiring: null });
  });
});
