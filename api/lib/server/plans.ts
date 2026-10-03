/** A subscription package. `maxUsers` counts accounts that can sign in; null means no limit. */
export type Plan = { id: string; label: string; maxUsers: number | null; priceMonthly: number };

export type SubscriptionStatus = "active" | "suspended";

/** What decides whether a business may use the app right now. */
export function subscriptionState(status: SubscriptionStatus, expiresAt: Date | string | null, now = new Date()): "active" | "suspended" | "expired" {
  if (status === "suspended") return "suspended";
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}
