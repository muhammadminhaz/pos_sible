import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { pool, ready } from "./pool";
import { effectiveModules, MODULE_IDS, monthlyEquivalent, subscriptionState, termInterval, type ModuleDef, type ModuleId, type PeriodUnit, type Plan, type SubscriptionStatus } from "./plans";
import { hashPassword } from "./passwords";
import { sqlName, TABLE_NAMES } from "./tables";
import { clearFails, recordFail, throttled } from "./throttle";

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

type PlanRow = { id: string; label: string; max_users: number | null; price: string; period_unit: PeriodUnit; period_count: number; modules: string[]; description: string; benefits: string[] };
const toPlan = (r: PlanRow): Plan => ({
  id: r.id, label: r.label, maxUsers: r.max_users, price: Number(r.price), periodUnit: r.period_unit, periodCount: r.period_count,
  modules: MODULE_IDS.filter((m) => r.modules.includes(m)), description: r.description, benefits: r.benefits,
});
const PLAN_COLUMNS = "id, label, max_users, price, period_unit, period_count, modules, description, benefits";

export async function getPlans(): Promise<Plan[]> {
  await ready();
  return (await pool().query<PlanRow>(`SELECT ${PLAN_COLUMNS} FROM plans ORDER BY sort, id`)).rows.map(toPlan);
}

export type PlanPatch = { label?: string; maxUsers?: number | null; price?: number; periodUnit?: PeriodUnit; periodCount?: number; modules?: ModuleId[]; description?: string; benefits?: string[] };

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "package";

/** Adds a package. Any number can exist; the id is made from the name plus a short random tail so it never collides. */
export async function createPlan(input: Required<Pick<PlanPatch, "label" | "price" | "periodUnit" | "periodCount" | "modules">> & Pick<PlanPatch, "maxUsers" | "description" | "benefits">): Promise<Plan> {
  await ready();
  const id = `${slug(input.label)}-${randomBytes(3).toString("hex")}`;
  const r = await pool().query<PlanRow>(
    `INSERT INTO plans (id, label, max_users, price, period_unit, period_count, modules, description, benefits, sort)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE((SELECT MAX(sort) FROM plans), 0) + 1) RETURNING ${PLAN_COLUMNS}`,
    [id, input.label, input.maxUsers ?? null, input.price, input.periodUnit, input.periodCount, MODULE_IDS.filter((m) => input.modules.includes(m)), input.description ?? "", input.benefits ?? []]);
  return toPlan(r.rows[0]);
}

const PLAN_COLUMN_OF: Record<keyof PlanPatch, string> = { label: "label", maxUsers: "max_users", price: "price", periodUnit: "period_unit", periodCount: "period_count", modules: "modules", description: "description", benefits: "benefits" };

/** Edits a package. It applies to every business on it straight away; a changed term length applies from the next activation. Returns false for an unknown package. */
export async function updatePlan(id: string, patch: PlanPatch): Promise<boolean> {
  await ready();
  const sets: string[] = [];
  const args: unknown[] = [id];
  for (const key of Object.keys(PLAN_COLUMN_OF) as (keyof PlanPatch)[]) {
    if (patch[key] === undefined) continue;
    args.push(key === "modules" ? MODULE_IDS.filter((m) => patch.modules!.includes(m)) : patch[key]);
    sets.push(`${PLAN_COLUMN_OF[key]} = $${args.length}`);
  }
  if (!sets.length) return (await pool().query("SELECT 1 FROM plans WHERE id = $1", [id])).rowCount === 1;
  return (await pool().query(`UPDATE plans SET ${sets.join(", ")} WHERE id = $1`, args)).rowCount === 1;
}

/** Removes a package nobody is on and nobody is scheduled to move to. The last one stays, because new businesses need a package to start on. */
export async function deletePlan(id: string): Promise<"deleted" | "in_use" | "last" | "not_found"> {
  await ready();
  if (Number((await pool().query<{ n: string }>("SELECT COUNT(*) AS n FROM plans")).rows[0].n) <= 1) return "last";
  if ((await pool().query("SELECT 1 FROM businesses WHERE plan = $1 OR next_plan = $1 LIMIT 1", [id])).rowCount) return "in_use";
  return (await pool().query("DELETE FROM plans WHERE id = $1", [id])).rowCount === 1 ? "deleted" : "not_found";
}

export async function getModules(): Promise<ModuleDef[]> {
  await ready();
  return (await pool().query<{ id: ModuleId; label: string }>("SELECT id, label FROM modules ORDER BY sort, id")).rows;
}

declare global {
  var __posibleAdminWarned: boolean | undefined;
}
const WINDOW = 15 * 60_000;

export type AdminLogin = { ok: true; token: string } | { ok: false; reason: "invalid" | "throttled" };

/** There is only one admin account, so this caps wrong passwords from all addresses together. */
const ADMIN_ACCOUNT_LIMIT = 20;
const ACCOUNT_KEY = "admin|account";

export async function adminLogin(username: string, password: string, ip: string): Promise<AdminLogin> {
  await ready();
  const ipKey = `admin|ip|${ip}`;
  if ((await throttled(ipKey, 5, WINDOW)) || (await throttled(ACCOUNT_KEY, ADMIN_ACCOUNT_LIMIT, WINDOW))) return { ok: false, reason: "throttled" };

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
    await recordFail(ipKey, WINDOW);
    await recordFail(ACCOUNT_KEY, WINDOW);
    return { ok: false, reason: "invalid" };
  }
  await clearFails(ipKey, ACCOUNT_KEY);
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
  /** What one term of the package costs (0 when free), and how long a term is. */
  price: number;
  periodUnit: PeriodUnit;
  periodCount: number;
  /** The price spread over 30 days, so daily, weekly and monthly packages can be added up. */
  priceMonthly: number;
  /** Modules the package includes, and the ones the business actually uses (all of them when free). */
  planModules: ModuleId[];
  modules: ModuleId[];
  /** A package change waiting for the current term to end; it applies at the next activation. */
  nextPlan: string | null;
  nextPlanLabel: string | null;
  /** When the last payment was received, or null if none was recorded. */
  lastPaidAt: string | null;
  /** Waived by the platform owner: no price, no end date, every module, unlimited users. */
  free: boolean;
  status: SubscriptionStatus;
  expiresAt: string | null;
  /** What actually applies now: "expired" when the date has passed. */
  state: "active" | "cancelled" | "expired";
  /** Every user the business has, whether or not they can sign in. */
  users: number;
  maxUsers: number | null;
  /** Bytes the business's records take in the database. */
  storageBytes: number;
  lastActiveAt: string | null;
};

const ENTITY_SIZES = TABLE_NAMES.map((t) => `SELECT business_id, SUM(pg_column_size(data))::bigint AS bytes FROM ${sqlName(t)} GROUP BY business_id`).join("\nUNION ALL\n");

/**
 * One row per business: its subscription, how many users it has, and how much space it uses. Only counts and
 * sizes are computed in SQL (SUM / COUNT over the records); no record content is selected.
 */
export async function listBusinesses(): Promise<BusinessSummary[]> {
  await ready();
  const { rows } = await pool().query<{
    id: string; name: string; created_at: Date; plan: string; plan_label: string; price: string; period_unit: PeriodUnit; period_count: number; plan_modules: string[]; max_users: number | null;
    next_plan: string | null; next_plan_label: string | null; last_paid: Date | null;
    subscription_status: SubscriptionStatus; subscription_expires_at: Date | null; owner: string | null; code: string; contact_email: string | null; contact_phone: string | null;
    modules: string[] | null; free: boolean; users: string; storage: string; last_active: Date | null;
  }>(`
    SELECT b.id, b.name, b.created_at, b.plan, p.label AS plan_label, p.price, p.period_unit, p.period_count, p.modules AS plan_modules, p.max_users,
           b.next_plan, np.label AS next_plan_label, pay.last_paid,
           b.subscription_status, b.subscription_expires_at, l.username AS owner, b.code, b.contact_email, b.contact_phone, b.modules, b.free,
           COALESCE(u.n, 0) AS users,
           COALESCE(s.bytes, 0) + pg_column_size(b.settings) + pg_column_size(b.meta) AS storage,
           a.last_active
      FROM businesses b
      JOIN plans p ON p.id = b.plan
      LEFT JOIN plans np ON np.id = b.next_plan
      LEFT JOIN logins l ON l.business_id = b.id AND l.user_id = 'user_admin'
      LEFT JOIN (SELECT business_id, MAX(paid_at) AS last_paid FROM subscription_payments WHERE amount > 0 GROUP BY business_id) pay ON pay.business_id = b.id
      LEFT JOIN (SELECT business_id, COUNT(*) AS n FROM users GROUP BY business_id) u ON u.business_id = b.id
      LEFT JOIN (SELECT business_id, SUM(bytes) AS bytes FROM (${ENTITY_SIZES}) x GROUP BY business_id) s ON s.business_id = b.id
      LEFT JOIN (SELECT business_id, MAX(at) AS last_active FROM audit_log GROUP BY business_id) a ON a.business_id = b.id
     ORDER BY b.created_at DESC`);
  return rows.map((r) => {
    const planModules = MODULE_IDS.filter((m) => r.plan_modules.includes(m));
    const price = r.free ? 0 : Number(r.price);
    return {
      id: r.id, name: r.name, createdAt: r.created_at.toISOString(), ownerUsername: r.owner, code: r.code, contactEmail: r.contact_email, contactPhone: r.contact_phone,
      plan: r.plan, planLabel: r.plan_label, price, periodUnit: r.period_unit, periodCount: r.period_count,
      priceMonthly: monthlyEquivalent({ price, periodUnit: r.period_unit, periodCount: r.period_count }), planModules, modules: effectiveModules(r.modules, r.free, planModules),
      nextPlan: r.next_plan, nextPlanLabel: r.next_plan_label, lastPaidAt: r.last_paid?.toISOString() ?? null,
      free: r.free, status: r.subscription_status, expiresAt: r.subscription_expires_at?.toISOString() ?? null,
      state: subscriptionState(r.subscription_status, r.subscription_expires_at, new Date(), r.free), users: Number(r.users),
      maxUsers: r.free ? null : r.max_users, storageBytes: Number(r.storage), lastActiveAt: r.last_active?.toISOString() ?? null,
    };
  });
}

export type SubscriptionPatch = { status?: SubscriptionStatus; expiresAt?: string | null; contactEmail?: string | null; contactPhone?: string | null; modules?: ModuleId[]; free?: boolean };

/** Changes only the on/off switch, the end date, the contact details, its modules and the free flag. Returns false when there is no such business. */
export async function setSubscription(businessId: string, patch: SubscriptionPatch): Promise<boolean> {
  await ready();
  const sets: string[] = [];
  const args: unknown[] = [businessId];
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

export const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_PROOF_BYTES = 2 * 1024 * 1024;

export type Activation = {
  /** How many terms of the package this payment covers. */
  terms: number;
  /** Package to move to. Left out, a scheduled change applies, else the business keeps its package. */
  plan?: string;
  /** Start a fresh term today instead of extending the current one (an immediate upgrade or downgrade). */
  restart?: boolean;
  /** What was actually received; the package price times the terms when left out. 0 (or a free business) is recorded as an activation with no money. */
  amount?: number;
  /** The transaction id the customer gave. A payment needs this or a proof image. */
  reference?: string;
  proof?: { data: Buffer; type: string };
};
export type ActivationResult = { ok: true; expiresAt: string; paymentId: number } | { ok: false; reason: "not_found" | "unknown_plan" | "proof_required" };

/**
 * Switches a subscription on after the platform owner received the money, and writes the payment down: the day it is
 * activated is the day it was paid, with the transaction id and proof image kept beside it. An active term is extended
 * from its end date; a cancelled or lapsed one (or `restart`) counts from today. A package change scheduled for the end of
 * the term applies here, and any package change goes back to the new package's own modules.
 */
export async function activateSubscription(businessId: string, a: Activation): Promise<ActivationResult> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const b = (await client.query<{ name: string; plan: string; next_plan: string | null; free: boolean }>("SELECT name, plan, next_plan, free FROM businesses WHERE id = $1 FOR UPDATE", [businessId])).rows[0];
    if (!b) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    const target = a.plan ?? b.next_plan ?? b.plan;
    const plan = (await client.query<PlanRow>(`SELECT ${PLAN_COLUMNS} FROM plans WHERE id = $1`, [target])).rows[0];
    if (!plan) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unknown_plan" };
    }
    const p = toPlan(plan);
    const amount = b.free ? 0 : Math.round((a.amount ?? p.price * a.terms) * 100) / 100;
    const reference = a.reference?.trim() || null;
    if (amount > 0 && !reference && !a.proof) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "proof_required" };
    }
    const r = await client.query<{ subscription_expires_at: Date }>(
      `UPDATE businesses
          SET plan = $2, next_plan = NULL, modules = CASE WHEN $2 <> plan THEN NULL ELSE modules END, subscription_status = 'active',
              subscription_expires_at = (CASE WHEN NOT $3::boolean AND subscription_status = 'active' AND subscription_expires_at > now() THEN subscription_expires_at ELSE now() END) + $4::interval
        WHERE id = $1
    RETURNING subscription_expires_at`, [businessId, target, !!a.restart, termInterval(p, a.terms)]);
    // Every activation is written down, even at 0: the day it happened is the day the business was paid.
    const paymentId = Number((await client.query<{ id: string }>(
      `INSERT INTO subscription_payments (business_id, business_name, plan, plan_label, terms, period_unit, period_count, amount, reference, proof, proof_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [businessId, b.name, target, p.label, a.terms, p.periodUnit, p.periodCount, amount, reference, a.proof?.data ?? null, a.proof?.type ?? null])).rows[0].id);
    await client.query("COMMIT");
    return { ok: true, expiresAt: r.rows[0].subscription_expires_at.toISOString(), paymentId };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Schedules a package change for when the current term ends (it applies at the next activation), or clears it with null. */
export async function scheduleChange(businessId: string, plan: string | null): Promise<"ok" | "not_found" | "unknown_plan"> {
  await ready();
  if (plan !== null && !(await pool().query("SELECT 1 FROM plans WHERE id = $1", [plan])).rowCount) return "unknown_plan";
  const r = await pool().query("UPDATE businesses SET next_plan = CASE WHEN $2::text = plan THEN NULL ELSE $2::text END WHERE id = $1", [businessId, plan]);
  return r.rowCount === 1 ? "ok" : "not_found";
}

export type Payment = { id: number; planLabel: string; terms: number; periodUnit: PeriodUnit; periodCount: number; amount: number; paidAt: string; reference: string | null; hasProof: boolean };

/** Every payment recorded for a business, newest first. The proof image itself is fetched separately. */
export async function listPayments(businessId: string): Promise<Payment[]> {
  await ready();
  const { rows } = await pool().query<{ id: string; label: string; terms: number; period_unit: PeriodUnit; period_count: number; amount: string; paid_at: Date; reference: string | null; has_proof: boolean }>(
    `SELECT id, COALESCE(plan_label, plan) AS label, terms, period_unit, period_count, amount, paid_at, reference, proof IS NOT NULL AS has_proof
       FROM subscription_payments WHERE business_id = $1 ORDER BY paid_at DESC, id DESC`, [businessId]);
  return rows.map((r) => ({ id: Number(r.id), planLabel: r.label, terms: r.terms, periodUnit: r.period_unit, periodCount: r.period_count, amount: Number(r.amount), paidAt: r.paid_at.toISOString(), reference: r.reference, hasProof: r.has_proof }));
}

export async function paymentProof(id: number): Promise<{ data: Buffer; type: string } | null> {
  await ready();
  const r = (await pool().query<{ proof: Buffer | null; proof_type: string | null }>("SELECT proof, proof_type FROM subscription_payments WHERE id = $1", [id])).rows[0];
  return r?.proof && r.proof_type ? { data: r.proof, type: r.proof_type } : null;
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
  recent: { id: number; businessId: string | null; businessName: string; plan: string; planLabel: string; terms: number; periodUnit: PeriodUnit; periodCount: number; amount: number; paidAt: string; reference: string | null; hasProof: boolean }[];
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
      `SELECT to_char(paid_at AT TIME ZONE $1, 'YYYY-MM') AS month, SUM(amount) AS amount, COUNT(*) AS payments FROM subscription_payments WHERE amount > 0 GROUP BY 1`, [REPORT_ZONE]),
    db.query<{ plan: string; label: string | null; amount: string }>(
      `SELECT sp.plan, COALESCE(p.label, MAX(sp.plan_label)) AS label, SUM(sp.amount) AS amount FROM subscription_payments sp LEFT JOIN plans p ON p.id = sp.plan WHERE sp.amount > 0 GROUP BY sp.plan, p.label ORDER BY SUM(sp.amount) DESC`),
    db.query<{ id: string; business_id: string | null; business_name: string; plan: string; label: string | null; terms: number; period_unit: PeriodUnit; period_count: number; amount: string; paid_at: Date; reference: string | null; has_proof: boolean }>(
      `SELECT sp.id, sp.business_id, sp.business_name, sp.plan, COALESCE(sp.plan_label, p.label) AS label, sp.terms, sp.period_unit, sp.period_count, sp.amount, sp.paid_at, sp.reference, sp.proof IS NOT NULL AS has_proof FROM subscription_payments sp LEFT JOIN plans p ON p.id = sp.plan WHERE sp.amount > 0 ORDER BY sp.paid_at DESC, sp.id DESC LIMIT 12`),
    db.query<{ total: string | null; n: string; first: Date | null }>(`SELECT SUM(amount) AS total, COUNT(*) AS n, MIN(paid_at) AS first FROM subscription_payments WHERE amount > 0`),
  ]);
  const { months, thisMonth, lastMonth } = revenueMonths(monthly.rows.map((r) => ({ month: r.month, amount: Number(r.amount), payments: Number(r.payments) })), now);
  return {
    total: Number(totals.rows[0].total ?? 0), thisMonth, lastMonth, payments: Number(totals.rows[0].n), firstPaymentAt: totals.rows[0].first?.toISOString() ?? null, months,
    byPlan: plans.rows.map((r) => ({ plan: r.plan, label: r.label ?? r.plan, amount: Number(r.amount) })),
    recent: recent.rows.map((r) => ({ id: Number(r.id), businessId: r.business_id, businessName: r.business_name, plan: r.plan, planLabel: r.label ?? r.plan, terms: r.terms, periodUnit: r.period_unit, periodCount: r.period_count, amount: Number(r.amount), paidAt: r.paid_at.toISOString(), reference: r.reference, hasProof: r.has_proof })),
  };
}
