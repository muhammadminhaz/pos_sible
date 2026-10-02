import { it, expect } from "vitest";
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
