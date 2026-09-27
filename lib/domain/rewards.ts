import { roundMoney } from "./money";

export type RewardSettings = {
  enabled: boolean;
  amountForUnitPoint: number;
  minOrderTotalToEarn: number;
  maxPointsPerOrder: number | null;
  redeemAmountPerPoint: number;
  minOrderTotalToRedeem: number;
  minRedeemPoint: number;
  maxRedeemPoint: number | null;
};

export function pointsEarned(total: number, s: RewardSettings): number {
  if (!s.enabled || total < s.minOrderTotalToEarn || s.amountForUnitPoint <= 0) return 0;
  const pts = Math.floor(total / s.amountForUnitPoint);
  return s.maxPointsPerOrder ? Math.min(pts, s.maxPointsPerOrder) : pts;
}

export function maxRedeemable(args: { total: number; balance: number; s: RewardSettings }): number {
  const { total, balance, s } = args;
  if (!s.enabled || total < s.minOrderTotalToRedeem || balance < s.minRedeemPoint || s.redeemAmountPerPoint <= 0) return 0;
  return Math.min(balance, s.maxRedeemPoint ?? Infinity, Math.floor(total / s.redeemAmountPerPoint));
}

export function redeemValue(points: number, s: RewardSettings): number {
  return roundMoney(points * s.redeemAmountPerPoint);
}
