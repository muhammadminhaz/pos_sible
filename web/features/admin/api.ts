export type Plan = { id: string; label: string; maxUsers: number | null; priceMonthly: number; description: string; benefits: string[] };
export type ModuleDef = { id: string; label: string; priceMonthly: number };
export type Business = {
  id: string; name: string; createdAt: string; ownerUsername: string | null; code: string; contactEmail: string | null; contactPhone: string | null; plan: string; planLabel: string; priceMonthly: number; modules: string[]; free: boolean;
  status: "active" | "cancelled"; expiresAt: string | null; state: "active" | "cancelled" | "expired";
  users: number; maxUsers: number | null; storageBytes: number; lastActiveAt: string | null;
};
export type Me = { username: string; plans: Plan[]; modules: ModuleDef[] };
export type RevenueReport = {
  total: number; thisMonth: number; lastMonth: number; payments: number; firstPaymentAt: string | null;
  months: { month: string; amount: number; payments: number }[];
  byPlan: { plan: string; label: string; amount: number }[];
  recent: { id: number; businessId: string | null; businessName: string; plan: string; planLabel: string; months: number; amount: number; paidAt: string }[];
};

export const call = (path: string, init?: RequestInit) =>
  fetch(`/api/admin/${path}`, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export const formatMoney = (n: number) => `৳${Math.round(n).toLocaleString("en-US")}`;
/** "Oct 26" for a "2026-10" month key. */
export const shortMonth = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** yyyy-mm-dd in the browser's own time zone, for the date picker. */
export const toDateValue = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
export const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();

export const STATE_LABEL = { active: "Active", cancelled: "Cancelled", expired: "Expired" } as const;

/** Terms a subscription can be renewed (or started) for. */
export const TERMS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
] as const;

/** Money a business brings in per month right now: only paying (active, not lapsed) subscriptions count. */
export const monthlyRevenue = (b: Business) => (b.state === "active" ? b.priceMonthly : 0);
