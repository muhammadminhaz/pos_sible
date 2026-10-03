/** A subscription package. `maxUsers` counts accounts that can sign in; null means no limit. */
export type Plan = { id: string; label: string; maxUsers: number | null; priceMonthly: number };

/** "cancelled" is the owner switching a business off; an end date in the past ("expired") is derived, not stored. */
export type SubscriptionStatus = "active" | "cancelled";

/** What decides whether a business may use the app right now. */
export function subscriptionState(status: SubscriptionStatus, expiresAt: Date | string | null, now = new Date()): "active" | "cancelled" | "expired" {
  if (status === "cancelled") return "cancelled";
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}
