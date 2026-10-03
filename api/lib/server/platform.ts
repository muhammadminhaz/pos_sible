import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { pool, ready } from "./pool";
import { effectiveModules, MODULE_IDS, subscriptionState, type ModuleDef, type ModuleId, type Plan, type SubscriptionStatus } from "./plans";
import { hashPassword } from "./passwords";
import { sqlName, TABLE_NAMES } from "./tables";

/**
 * The platform owner: the person who sells subscriptions, not a user of any business. Credentials come from the
 * environment (docker-compose passes ADMIN_USERNAME / ADMIN_PASSWORD) and are never stored in the database.
 * Everything here returns totals and subscription facts only; there is deliberately no way to read a business's
 * records or to sign in as one of its users.
 */
export const ADMIN_COOKIE = "posible_admin";
const TTL_MS = 8 * 3_600_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Whatever the environment says; with no password set there is no admin account. */
export function adminCredentials(): { username: string; password: string } {
  return { username: process.env.ADMIN_USERNAME?.trim() ?? "", password: process.env.ADMIN_PASSWORD ?? "" };
}

type PlanRow = { id: string; label: string; max_users: number | null; price_monthly: string; description: string; benefits: string[] };
const toPlan = (r: PlanRow): Plan => ({ id: r.id, label: r.label, maxUsers: r.max_users, priceMonthly: Number(r.price_monthly), description: r.description, benefits: r.benefits });

export async function getPlans(): Promise<Plan[]> {
  await ready();
  return (await pool().query<PlanRow>("SELECT id, label, max_users, price_monthly, description, benefits FROM plans ORDER BY sort, id")).rows.map(toPlan);
}

export type PlanPatch = { label?: string; maxUsers?: number | null; priceMonthly?: number; description?: string; benefits?: string[] };

/** Edits what a package is called, how many users it allows and what it costs. Returns false for an unknown package. */
export async function updatePlan(id: string, patch: PlanPatch): Promise<boolean> {
  await ready();
  const sets: string[] = [];
  const args: unknown[] = [id];
  if (patch.label !== undefined) { args.push(patch.label); sets.push(`label = $${args.length}`); }
  if (patch.maxUsers !== undefined) { args.push(patch.maxUsers); sets.push(`max_users = $${args.length}`); }
  if (patch.priceMonthly !== undefined) { args.push(patch.priceMonthly); sets.push(`price_monthly = $${args.length}`); }
  if (patch.description !== undefined) { args.push(patch.description); sets.push(`description = $${args.length}`); }
  if (patch.benefits !== undefined) { args.push(patch.benefits); sets.push(`benefits = $${args.length}`); }
  if (!sets.length) return (await pool().query("SELECT 1 FROM plans WHERE id = $1", [id])).rowCount === 1;
  return (await pool().query(`UPDATE plans SET ${sets.join(", ")} WHERE id = $1`, args)).rowCount === 1;
}

type ModuleRow = { id: ModuleId; label: string; price_monthly: string };

export async function getModules(): Promise<ModuleDef[]> {
  await ready();
  return (await pool().query<ModuleRow>("SELECT id, label, price_monthly FROM modules ORDER BY sort, id")).rows.map((r) => ({ id: r.id, label: r.label, priceMonthly: Number(r.price_monthly) }));
}

/** Changes what a module adds to the monthly price. Returns false for an unknown module. */
export async function updateModulePrice(id: string, priceMonthly: number): Promise<boolean> {
  await ready();
  return (await pool().query("UPDATE modules SET price_monthly = $2 WHERE id = $1", [id, priceMonthly])).rowCount === 1;
}

declare global {
  var __posibleAdminWarned: boolean | undefined;
  var __posibleAdminFails: Map<string, { n: number; first: number }> | undefined;
}
const fails = () => (globalThis.__posibleAdminFails ??= new Map());
const WINDOW = 15 * 60_000;

export type AdminLogin = { ok: true; token: string } | { ok: false; reason: "invalid" | "throttled" };

/** There is only one admin account, so this caps wrong passwords from all addresses together. */
const ADMIN_ACCOUNT_LIMIT = 20;
const ACCOUNT_KEY = "|admin|";
const over = (key: string, limit: number) => {
  const f = fails().get(key);
  return !!f && Date.now() - f.first <= WINDOW && f.n >= limit;
};
const bump = (key: string) => {
  const cur = fails().get(key);
  if (!cur || Date.now() - cur.first > WINDOW) fails().set(key, { n: 1, first: Date.now() });
  else cur.n++;
};

export async function adminLogin(username: string, password: string, ip: string): Promise<AdminLogin> {
  await ready();
  if (over(ip, 5) || over(ACCOUNT_KEY, ADMIN_ACCOUNT_LIMIT)) return { ok: false, reason: "throttled" };

  const want = adminCredentials();
  if (!want.username || !want.password) {
    if (!globalThis.__posibleAdminWarned) {
      globalThis.__posibleAdminWarned = true;
      console.error("[admin] Admin sign-in is off: set ADMIN_USERNAME and ADMIN_PASSWORD.");
    }
    return { ok: false, reason: "invalid" };
  }
  // Both fields are always compared, so timing doesn't say which one was wrong.
  const good = same(username.trim(), want.username) && same(password, want.password);
  if (!good) {
    bump(ip);
    bump(ACCOUNT_KEY);
    return { ok: false, reason: "invalid" };
  }
  fails().delete(ip);
  fails().delete(ACCOUNT_KEY);
  const token = randomBytes(32).toString("base64url");
  await pool().query("INSERT INTO platform_sessions (token_hash, expires_at) VALUES ($1, now() + $2 * interval '1 millisecond')", [sha(token), TTL_MS]);
  void pool().query("DELETE FROM platform_sessions WHERE expires_at < now()").catch(() => {});
  return { ok: true, token };
}

export async function adminLogout(token: string | undefined): Promise<void> {
  if (token) await pool().query("DELETE FROM platform_sessions WHERE token_hash = $1", [sha(token)]);
}

export async function isAdmin(req: NextRequest | { cookies: { get(name: string): { value: string } | undefined } }): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  await ready();
  const r = await pool().query("SELECT 1 FROM platform_sessions WHERE token_hash = $1 AND expires_at > now()", [sha(token)]);
  return (r.rowCount ?? 0) > 0;
}

export const adminCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000 });

export type BusinessSummary = {
  id: string;
  name: string;
  createdAt: string;
  /** The owner's sign-in name: what the platform owner types to confirm a deletion. */
  ownerUsername: string | null;
  /** What staff type at sign-in to reach this business. */
  code: string;
  contactEmail: string | null;
  contactPhone: string | null;
  plan: string;
  planLabel: string;
  /** What the business pays per month: package plus its modules, or 0 when free. */
  priceMonthly: number;
  /** Modules the business can use (all of them when free). */
  modules: ModuleId[];
  /** Waived by the platform owner: no price, no end date, every module, unlimited users. */
  free: boolean;
  status: SubscriptionStatus;
  expiresAt: string | null;
  /** What actually applies now: "expired" when the date has passed. */
  state: "active" | "cancelled" | "expired";
  /** Accounts that can sign in. */
  users: number;
  maxUsers: number | null;
  /** Bytes the business's records take in the database. */
  storageBytes: number;
  lastActiveAt: string | null;
};

const ENTITY_SIZES = TABLE_NAMES.map((t) => `SELECT business_id, SUM(pg_column_size(data))::bigint AS bytes FROM ${sqlName(t)} GROUP BY business_id`).join("\nUNION ALL\n");

/**
 * One row per business: its subscription, how many people can sign in, and how much space it uses. Only counts and
 * sizes are computed in SQL (SUM / COUNT over the records); no record content is selected.
 */
export async function listBusinesses(): Promise<BusinessSummary[]> {
  await ready();
  const { rows } = await pool().query<{
    id: string; name: string; created_at: Date; plan: string; plan_label: string; price: string; max_users: number | null;
    subscription_status: SubscriptionStatus; subscription_expires_at: Date | null; owner: string | null; code: string; contact_email: string | null; contact_phone: string | null;
    modules: string[] | null; free: boolean; users: string; storage: string; last_active: Date | null;
  }>(`
    SELECT b.id, b.name, b.created_at, b.plan, p.label AS plan_label, p.price_monthly AS price, p.max_users,
           b.subscription_status, b.subscription_expires_at, l.username AS owner, b.code, b.contact_email, b.contact_phone, b.modules, b.free,
           COALESCE(u.n, 0) AS users,
           COALESCE(s.bytes, 0) + pg_column_size(b.settings) + pg_column_size(b.meta) AS storage,
           a.last_active
      FROM businesses b
      JOIN plans p ON p.id = b.plan
      LEFT JOIN logins l ON l.business_id = b.id AND l.user_id = 'user_admin'
      LEFT JOIN (SELECT business_id, COUNT(*) AS n FROM users WHERE (data->>'allowLogin')::boolean IS NOT FALSE GROUP BY business_id) u ON u.business_id = b.id
      LEFT JOIN (SELECT business_id, SUM(bytes) AS bytes FROM (${ENTITY_SIZES}) x GROUP BY business_id) s ON s.business_id = b.id
      LEFT JOIN (SELECT business_id, MAX(at) AS last_active FROM audit_log GROUP BY business_id) a ON a.business_id = b.id
     ORDER BY b.created_at DESC`);
  const prices = new Map((await getModules()).map((m) => [m.id, m.priceMonthly]));
  return rows.map((r) => {
    const modules = effectiveModules(r.modules, r.free);
    return {
      id: r.id, name: r.name, createdAt: r.created_at.toISOString(), ownerUsername: r.owner, code: r.code, contactEmail: r.contact_email, contactPhone: r.contact_phone,
      plan: r.plan, planLabel: r.plan_label, priceMonthly: r.free ? 0 : Number(r.price) + modules.reduce((sum, m) => sum + (prices.get(m) ?? 0), 0),
      modules, free: r.free, status: r.subscription_status, expiresAt: r.subscription_expires_at?.toISOString() ?? null,
      state: subscriptionState(r.subscription_status, r.subscription_expires_at, new Date(), r.free), users: Number(r.users),
      maxUsers: r.free ? null : r.max_users, storageBytes: Number(r.storage), lastActiveAt: r.last_active?.toISOString() ?? null,
    };
  });
}

export type SubscriptionPatch = { plan?: string; status?: SubscriptionStatus; expiresAt?: string | null; contactEmail?: string | null; contactPhone?: string | null; modules?: ModuleId[]; free?: boolean };

/** Changes only the package, the on/off switch, the end date, the contact details, its modules and the free flag. Returns false when there is no such business. */
export async function setSubscription(businessId: string, patch: SubscriptionPatch): Promise<boolean> {
  await ready();
  const sets: string[] = [];
  const args: unknown[] = [businessId];
  if (patch.plan) { args.push(patch.plan); sets.push(`plan = $${args.length}`); }
  if (patch.status) { args.push(patch.status); sets.push(`subscription_status = $${args.length}`); }
  if (patch.expiresAt !== undefined) { args.push(patch.expiresAt); sets.push(`subscription_expires_at = $${args.length}`); }
  if (patch.contactEmail !== undefined) { args.push(patch.contactEmail); sets.push(`contact_email = $${args.length}`); }
  if (patch.contactPhone !== undefined) { args.push(patch.contactPhone); sets.push(`contact_phone = $${args.length}`); }
  if (patch.modules) { args.push(MODULE_IDS.filter((m) => patch.modules!.includes(m))); sets.push(`modules = $${args.length}`); }
  if (patch.free !== undefined) { args.push(patch.free); sets.push(`free = $${args.length}`); }
  if (!sets.length) return (await pool().query("SELECT 1 FROM businesses WHERE id = $1", [businessId])).rowCount === 1;
  const r = await pool().query(`UPDATE businesses SET ${sets.join(", ")} WHERE id = $1`, args);
  // A cancelled business is signed out everywhere straight away.
  if (patch.status === "cancelled") await pool().query("DELETE FROM sessions WHERE business_id = $1", [businessId]);
  return r.rowCount === 1;
}

/**
 * Gives the business owner a new password (the one the platform owner chose) and signs them out. The platform owner
 * can never read a password, only replace it. Returns false when the business has no owner account.
 */
export async function resetOwnerPassword(businessId: string, password: string): Promise<boolean> {
  await ready();
  const owner = (await pool().query<{ user_id: string }>("SELECT user_id FROM logins WHERE business_id = $1 AND user_id = 'user_admin'", [businessId])).rows[0];
  if (!owner) return false;
  await pool().query("UPDATE users SET data = jsonb_set(data, '{password}', to_jsonb($3::text)) WHERE business_id = $1 AND id = $2", [businessId, owner.user_id, hashPassword(password)]);
  await pool().query("UPDATE businesses SET version = version + 1 WHERE id = $1", [businessId]); // makes every server reload the business
  await pool().query("DELETE FROM sessions WHERE business_id = $1 AND user_id = $2", [businessId, owner.user_id]);
  return true;
}

/**
 * Permanently removes a business and everything in it. The caller must type the owner's username, so a stray click or a
 * wrong row can't do it. Returns "not_found", "mismatch" or "deleted".
 */
export async function deleteBusiness(businessId: string, confirmUsername: string): Promise<"not_found" | "mismatch" | "deleted"> {
  await ready();
  const row = (await pool().query<{ owner: string | null }>("SELECT l.username AS owner FROM businesses b LEFT JOIN logins l ON l.business_id = b.id AND l.user_id = 'user_admin' WHERE b.id = $1", [businessId])).rows[0];
  if (!row) return "not_found";
  if (!row.owner || row.owner.toLowerCase() !== confirmUsername.trim().toLowerCase()) return "mismatch";
  await pool().query("DELETE FROM audit_log WHERE business_id = $1", [businessId]);
  await pool().query("DELETE FROM businesses WHERE id = $1", [businessId]); // tables, logins and sessions cascade
  globalThis.__posibleCache?.delete(businessId);
  return "deleted";
}

/** What a business pays per month right now (package plus its modules, 0 when free), with the names a payment row keeps. */
async function priceOf(businessId: string): Promise<{ name: string; plan: string; price: number } | null> {
  const r = (await pool().query<{ name: string; plan: string; modules: string[] | null; free: boolean; price: string }>(
    "SELECT b.name, b.plan, b.modules, b.free, p.price_monthly AS price FROM businesses b JOIN plans p ON p.id = b.plan WHERE b.id = $1", [businessId])).rows[0];
  if (!r) return null;
  const prices = new Map((await getModules()).map((m) => [m.id, m.priceMonthly]));
  const price = r.free ? 0 : Number(r.price) + effectiveModules(r.modules, r.free).reduce((sum, m) => sum + (prices.get(m) ?? 0), 0);
  return { name: r.name, plan: r.plan, price };
}

/**
 * Writes down money received for `months` of a business's subscription. The amount defaults to the monthly price times
 * the months; pass one to record a discount or a part payment. Free businesses and zero amounts record nothing.
 */
export async function recordPayment(businessId: string, months: number, amount?: number): Promise<void> {
  const info = await priceOf(businessId);
  if (!info) return;
  const paid = Math.round((amount ?? info.price * months) * 100) / 100;
  if (!(paid > 0)) return;
  await pool().query("INSERT INTO subscription_payments (business_id, business_name, plan, months, amount) VALUES ($1, $2, $3, $4, $5)", [businessId, info.name, info.plan, months, paid]);
}

/**
 * Renews a subscription for `months` and switches it back on, recording the payment (`amount` overrides the list price).
 * An active subscription is extended from its end date (so renewing early never loses days); a cancelled or lapsed one
 * starts counting from today. Returns the new end date, or null for an unknown business.
 */
export async function renewSubscription(businessId: string, months: number, amount?: number): Promise<string | null> {
  await ready();
  const r = await pool().query<{ subscription_expires_at: Date }>(
    `UPDATE businesses
        SET subscription_expires_at = (CASE WHEN subscription_status = 'active' THEN GREATEST(now(), COALESCE(subscription_expires_at, now())) ELSE now() END) + $2 * interval '1 month',
            subscription_status = 'active'
      WHERE id = $1
  RETURNING subscription_expires_at`, [businessId, months]);
  if (!r.rows[0]) return null;
  await recordPayment(businessId, months, amount);
  return r.rows[0].subscription_expires_at.toISOString();
}

/** Ends a subscription: nobody in the business can sign in until it is renewed, and everyone is signed out now. */
export async function cancelSubscription(businessId: string): Promise<boolean> {
  return setSubscription(businessId, { status: "cancelled" });
}

/** Changes the code staff type at sign-in. Returns "taken" when another business already uses it. */
export async function setBusinessCode(businessId: string, code: string): Promise<"ok" | "taken" | "not_found"> {
  await ready();
  try {
    const r = await pool().query("UPDATE businesses SET code = $2 WHERE id = $1", [businessId, code]);
    return r.rowCount === 1 ? "ok" : "not_found";
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return "taken";
    throw e;
  }
}

// ── Revenue ─────────────────────────────────────────────────────────────

export type RevenueMonth = { month: string; amount: number; payments: number };
export type RevenueReport = {
  /** Everything received since the first recorded payment. */
  total: number;
  thisMonth: number;
  lastMonth: number;
  payments: number;
  firstPaymentAt: string | null;
  /** The last 12 months, oldest first, with empty months as zero so the chart has no gaps. */
  months: RevenueMonth[];
  byPlan: { plan: string; label: string; amount: number }[];
  recent: { id: number; businessId: string | null; businessName: string; plan: string; planLabel: string; months: number; amount: number; paidAt: string }[];
};

const REPORT_ZONE = "Asia/Dhaka";
const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_ZONE, year: "numeric", month: "2-digit" }).format(d);

/** Turns per-month sums into the last 12 months (oldest first, gaps filled with zero) plus this and last month. */
export function revenueMonths(rows: { month: string; amount: number; payments: number }[], now: Date): { months: RevenueMonth[]; thisMonth: number; lastMonth: number } {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const [y, m] = monthKey(now).split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const r = byMonth.get(key);
    return { month: key, amount: r?.amount ?? 0, payments: r?.payments ?? 0 };
  });
  return { months, thisMonth: months[11].amount, lastMonth: months[10].amount };
}

export async function revenueReport(now = new Date()): Promise<RevenueReport> {
  await ready();
  const db = pool();
  const [monthly, plans, recent, totals] = await Promise.all([
    db.query<{ month: string; amount: string; payments: string }>(
      `SELECT to_char(paid_at AT TIME ZONE $1, 'YYYY-MM') AS month, SUM(amount) AS amount, COUNT(*) AS payments FROM subscription_payments GROUP BY 1`, [REPORT_ZONE]),
    db.query<{ plan: string; label: string | null; amount: string }>(
      `SELECT sp.plan, p.label, SUM(sp.amount) AS amount FROM subscription_payments sp LEFT JOIN plans p ON p.id = sp.plan GROUP BY sp.plan, p.label ORDER BY SUM(sp.amount) DESC`),
    db.query<{ id: string; business_id: string | null; business_name: string; plan: string; label: string | null; months: number; amount: string; paid_at: Date }>(
      `SELECT sp.id, sp.business_id, sp.business_name, sp.plan, p.label, sp.months, sp.amount, sp.paid_at FROM subscription_payments sp LEFT JOIN plans p ON p.id = sp.plan ORDER BY sp.paid_at DESC, sp.id DESC LIMIT 12`),
    db.query<{ total: string | null; n: string; first: Date | null }>(`SELECT SUM(amount) AS total, COUNT(*) AS n, MIN(paid_at) AS first FROM subscription_payments`),
  ]);
  const { months, thisMonth, lastMonth } = revenueMonths(monthly.rows.map((r) => ({ month: r.month, amount: Number(r.amount), payments: Number(r.payments) })), now);
  return {
    total: Number(totals.rows[0].total ?? 0), thisMonth, lastMonth, payments: Number(totals.rows[0].n), firstPaymentAt: totals.rows[0].first?.toISOString() ?? null, months,
    byPlan: plans.rows.map((r) => ({ plan: r.plan, label: r.label ?? r.plan, amount: Number(r.amount) })),
    recent: recent.rows.map((r) => ({ id: Number(r.id), businessId: r.business_id, businessName: r.business_name, plan: r.plan, planLabel: r.label ?? r.plan, months: r.months, amount: Number(r.amount), paidAt: r.paid_at.toISOString() })),
  };
}
