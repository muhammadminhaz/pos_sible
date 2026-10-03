/** Subscription packages. `maxUsers` counts accounts that can sign in; null means no limit. */
export const PLANS = {
  starter: { label: "Starter", maxUsers: 3 },
  standard: { label: "Standard", maxUsers: 10 },
  premium: { label: "Premium", maxUsers: null },
} as const;

export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const isPlan = (v: unknown): v is PlanId => typeof v === "string" && Object.hasOwn(PLANS, v);

export type SubscriptionStatus = "active" | "suspended";

/** What decides whether a business may use the app right now. */
export function subscriptionState(status: SubscriptionStatus, expiresAt: Date | string | null, now = new Date()): "active" | "suspended" | "expired" {
  if (status === "suspended") return "suspended";
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}
