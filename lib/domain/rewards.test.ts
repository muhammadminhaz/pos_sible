import { it, expect } from "vitest";
import { pointsEarned, maxRedeemable, redeemValue, type RewardSettings } from "./rewards";

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
