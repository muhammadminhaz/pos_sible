export type PeriodUnit = "day" | "week" | "month";
export type Plan = { id: string; label: string; maxUsers: number | null; price: number; periodUnit: PeriodUnit; periodCount: number; modules: string[]; description: string; benefits: string[] };
export type ModuleDef = { id: string; label: string };
export type Payment = { id: number; planLabel: string; terms: number; periodUnit: PeriodUnit; periodCount: number; amount: number; paidAt: string; reference: string | null; hasProof: boolean };
export type Business = {
  id: string; name: string; createdAt: string; ownerUsername: string | null; code: string; contactEmail: string | null; contactPhone: string | null; plan: string; planLabel: string; price: number; periodUnit: PeriodUnit; periodCount: number; priceMonthly: number; planModules: string[]; modules: string[];
  nextPlan: string | null; nextPlanLabel: string | null; lastPaidAt: string | null; free: boolean;
  status: "active" | "cancelled"; expiresAt: string | null; state: "active" | "cancelled" | "expired";
  users: number; maxUsers: number | null; storageBytes: number; lastActiveAt: string | null;
};
export type Me = { username: string; plans: Plan[]; modules: ModuleDef[]; currency: string };
export type RevenueReport = {
  total: number; thisMonth: number; lastMonth: number; payments: number; firstPaymentAt: string | null;
  months: { month: string; amount: number; payments: number }[];
  byPlan: { plan: string; label: string; amount: number }[];
  recent: { id: number; businessId: string | null; businessName: string; plan: string; planLabel: string; terms: number; periodUnit: PeriodUnit; periodCount: number; amount: number; paidAt: string; reference: string | null; hasProof: boolean }[];
};

export const call = (path: string, init?: RequestInit) =>
  fetch(`/api/admin/${path}`, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });

/** Sends a form (a file can ride along); the browser sets the multipart content type itself. */
export const callForm = (path: string, form: FormData) => fetch(`/api/admin/${path}`, { credentials: "same-origin", method: "POST", body: form });

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

// ponytail: module-level currency set from /me, so the ~18 formatMoney call sites need no context threading.
let currency = "BDT";
export const setCurrency = (code: string) => { currency = code; };
export const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(Math.round(n));
/** "Oct 26" for a "2026-10" month key. */
export const shortMonth = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** yyyy-mm-dd in the browser's own time zone, for the date picker. */
export const toDateValue = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
export const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();

export const STATE_LABEL = { active: "Active", cancelled: "Cancelled", expired: "Expired" } as const;

/** "1 month", "2 weeks", "10 days". */
export const termText = (unit: PeriodUnit, count: number) => `${count} ${unit}${count === 1 ? "" : "s"}`;
/** "৳500 per month", "$120 per 2 weeks" (in the platform currency). */
export const priceText = (p: Pick<Plan, "price" | "periodUnit" | "periodCount">) => `${formatMoney(p.price)} per ${p.periodCount === 1 ? p.periodUnit : termText(p.periodUnit, p.periodCount)}`;

/** `terms` terms after `from`; mirrors how the server adds them (calendar months, plain days and weeks). */
export function addTerms(from: Date, plan: Pick<Plan, "periodUnit" | "periodCount">, terms: number): Date {
  const d = new Date(from);
  const n = plan.periodCount * terms;
  if (plan.periodUnit === "month") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n * (plan.periodUnit === "week" ? 7 : 1));
  return d;
}

/** Money a business brings in per month right now: only paying (active, not lapsed) subscriptions count. */
export const monthlyRevenue = (b: Business) => (b.state === "active" ? b.priceMonthly : 0);
