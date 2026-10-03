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

/** Redeeming zero is fine; anything else must reach the minimum and stay under the cap. */
export function isValidRedeem(points: number, max: number, s: RewardSettings): boolean {
  return points === 0 || (Number.isInteger(points) && points >= s.minRedeemPoint && points <= max);
}

/** Points already promised to this customer's other suspended sales; they can't be spent twice. */
export function reservedPoints(txns: { id: string; type: string; status: string; contactId: string | null; pointsRedeemed: number }[], contactId: string, exceptId?: string): number {
  return txns.filter((t) => t.type === "sell" && t.status === "suspended" && t.contactId === contactId && t.id !== exceptId).reduce((n, t) => n + t.pointsRedeemed, 0);
}

export type PointEvent = { date: string; earned: number; redeemed: number };
export type PointsPosition = {
  /** Points the customer can spend today. */
  available: number;
  /** Points that lapsed unspent. */
  expired: number;
  /** The soonest batch about to lapse (within 30 days), if any. */
  expiring: { points: number; on: string } | null;
};

const dayOf = (s: string) => s.slice(0, 10);
const addPeriod = (date: string, n: number, type: "month" | "year") => {
  const d = new Date(`${dayOf(date)}T00:00:00Z`);
  if (type === "year") d.setUTCFullYear(d.getUTCFullYear() + n);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Splits a customer's points into spendable, lapsed and soon-to-lapse. Each sale's earned points form a batch that
 * lapses `expiryPeriod` after the sale; redemptions use the oldest unexpired batch first. Everything is derived from
 * the sales history, so editing or deleting a sale can never leave a stale expiry behind. Points the history doesn't
 * explain (a manual opening balance) never lapse.
 */
export function pointsPosition(args: {
  stored: number;
  events: PointEvent[];
  today: string;
  expiryPeriod: number | null | undefined;
  expiryType: "month" | "year";
}): PointsPosition {
  const { stored, today } = args;
  if (!args.expiryPeriod || args.expiryPeriod <= 0) return { available: stored, expired: 0, expiring: null };
  const events = [...args.events].sort((a, b) => a.date.localeCompare(b.date));
  const net = events.reduce((n, e) => n + e.earned - e.redeemed, 0);
  type Batch = { expiresOn: string | null; left: number };
  const batches: Batch[] = [{ expiresOn: null, left: Math.max(0, stored - net) }];
  for (const e of events) {
    if (e.redeemed > 0) {
      let need = e.redeemed;
      for (const b of batches) {
        if (need <= 0) break;
        if (b.left <= 0 || (b.expiresOn && b.expiresOn <= dayOf(e.date))) continue; // already lapsed when this sale happened
        const take = Math.min(b.left, need);
        b.left -= take;
        need -= take;
      }
    }
    if (e.earned > 0) batches.push({ expiresOn: addPeriod(e.date, args.expiryPeriod, args.expiryType), left: e.earned });
  }
  let available = 0, expired = 0;
  let soon: { points: number; on: string } | null = null;
  const horizon = new Date(new Date(`${dayOf(today)}T00:00:00Z`).getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  for (const b of batches) {
    if (b.left <= 0) continue;
    if (b.expiresOn && b.expiresOn <= dayOf(today)) expired += b.left;
    else {
      available += b.left;
      if (b.expiresOn && b.expiresOn <= horizon && (!soon || b.expiresOn < soon.on)) soon = { points: b.left, on: b.expiresOn };
    }
  }
  // Never promise more than the stored balance (a hand-edited balance wins over the derivation).
  const cap = Math.max(0, stored);
  if (available > cap) available = cap;
  return { available, expired, expiring: soon };
}

/** Spendable / lapsed points for one customer, from the sales history. */
export function customerPoints(
  db: { transactions: { type: string; status: string; contactId: string | null; date: string; pointsEarned: number; pointsRedeemed: number }[]; settings: { rewards: { enabled: boolean; expiryPeriod: number | null; expiryType: "month" | "year" } } },
  contact: { id: string; points: number },
  today: string,
): PointsPosition {
  const r = db.settings.rewards;
  const events = db.transactions
    .filter((t) => t.type === "sell" && t.status === "final" && t.contactId === contact.id && (t.pointsEarned > 0 || t.pointsRedeemed > 0))
    .map((t) => ({ date: t.date, earned: t.pointsEarned, redeemed: t.pointsRedeemed }));
  return pointsPosition({ stored: contact.points, events, today, expiryPeriod: r.enabled ? r.expiryPeriod : null, expiryType: r.expiryType });
}
