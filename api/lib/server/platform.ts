import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { pool, ready } from "./pool";
import { isPlan, PLANS, subscriptionState, type PlanId, type SubscriptionStatus } from "./plans";
import { sqlName, TABLE_NAMES } from "./tables";

/**
 * The platform owner: the person who sells subscriptions, not a user of any business. Credentials come from the
 * environment (docker-compose passes ADMIN_USERNAME / ADMIN_PASSWORD) and are never stored in the database.
 * Everything here returns totals and subscription facts only; there is deliberately no way to read a business's
 * records or to sign in as one of its users.
 */
export const ADMIN_COOKIE = "posible_admin";
const DEFAULT_USERNAME = "minhaz";
const DEFAULT_PASSWORD = "11111111";
const TTL_MS = 8 * 3_600_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export function adminCredentials(): { username: string; password: string; isDefault: boolean } {
  const username = process.env.ADMIN_USERNAME?.trim() || DEFAULT_USERNAME;
  const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  return { username, password, isDefault: password === DEFAULT_PASSWORD };
}

declare global {
  var __posibleAdminWarned: boolean | undefined;
  var __posibleAdminFails: Map<string, { n: number; first: number }> | undefined;
}
const fails = () => (globalThis.__posibleAdminFails ??= new Map());
const WINDOW = 15 * 60_000;

export type AdminLogin = { ok: true; token: string } | { ok: false; reason: "invalid" | "throttled" };

export async function adminLogin(username: string, password: string, ip: string): Promise<AdminLogin> {
  await ready();
  const f = fails().get(ip);
  if (f && Date.now() - f.first <= WINDOW && f.n >= 5) return { ok: false, reason: "throttled" };

  const want = adminCredentials();
  if (want.isDefault && process.env.NODE_ENV === "production" && !globalThis.__posibleAdminWarned) {
    globalThis.__posibleAdminWarned = true;
    console.warn("[admin] ADMIN_PASSWORD is still the default. Set ADMIN_USERNAME and ADMIN_PASSWORD before going live.");
  }
  // Both fields are always compared, so timing doesn't say which one was wrong.
  const good = same(username.trim(), want.username) && same(password, want.password);
  if (!good) {
    const cur = fails().get(ip);
    if (!cur || Date.now() - cur.first > WINDOW) fails().set(ip, { n: 1, first: Date.now() });
    else cur.n++;
    return { ok: false, reason: "invalid" };
  }
  fails().delete(ip);
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
  plan: PlanId;
  status: SubscriptionStatus;
  expiresAt: string | null;
  /** What actually applies now: "expired" when the date has passed. */
  state: "active" | "suspended" | "expired";
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
    id: string; name: string; created_at: Date; plan: string; subscription_status: SubscriptionStatus; subscription_expires_at: Date | null;
    users: string; storage: string; last_active: Date | null;
  }>(`
    SELECT b.id, b.name, b.created_at, b.plan, b.subscription_status, b.subscription_expires_at,
           COALESCE(u.n, 0) AS users,
           COALESCE(s.bytes, 0) + pg_column_size(b.settings) + pg_column_size(b.meta) AS storage,
           a.last_active
      FROM businesses b
      LEFT JOIN (SELECT business_id, COUNT(*) AS n FROM users WHERE (data->>'allowLogin')::boolean IS NOT FALSE GROUP BY business_id) u ON u.business_id = b.id
      LEFT JOIN (SELECT business_id, SUM(bytes) AS bytes FROM (${ENTITY_SIZES}) x GROUP BY business_id) s ON s.business_id = b.id
      LEFT JOIN (SELECT business_id, MAX(at) AS last_active FROM audit_log GROUP BY business_id) a ON a.business_id = b.id
     ORDER BY b.created_at DESC`);
  return rows.map((r) => {
    const plan: PlanId = isPlan(r.plan) ? r.plan : "standard";
    return {
      id: r.id, name: r.name, createdAt: r.created_at.toISOString(), plan, status: r.subscription_status,
      expiresAt: r.subscription_expires_at?.toISOString() ?? null, state: subscriptionState(r.subscription_status, r.subscription_expires_at),
      users: Number(r.users), maxUsers: PLANS[plan].maxUsers, storageBytes: Number(r.storage), lastActiveAt: r.last_active?.toISOString() ?? null,
    };
  });
}

export type SubscriptionPatch = { plan?: PlanId; status?: SubscriptionStatus; expiresAt?: string | null };

/** Changes only the package, the on/off switch and the end date. Returns false when there is no such business. */
export async function setSubscription(businessId: string, patch: SubscriptionPatch): Promise<boolean> {
  await ready();
  const sets: string[] = [];
  const args: unknown[] = [businessId];
  if (patch.plan) { args.push(patch.plan); sets.push(`plan = $${args.length}`); }
  if (patch.status) { args.push(patch.status); sets.push(`subscription_status = $${args.length}`); }
  if (patch.expiresAt !== undefined) { args.push(patch.expiresAt); sets.push(`subscription_expires_at = $${args.length}`); }
  if (!sets.length) return (await pool().query("SELECT 1 FROM businesses WHERE id = $1", [businessId])).rowCount === 1;
  const r = await pool().query(`UPDATE businesses SET ${sets.join(", ")} WHERE id = $1`, args);
  // A suspended business is signed out everywhere straight away.
  if (patch.status === "suspended") await pool().query("DELETE FROM sessions WHERE business_id = $1", [businessId]);
  return r.rowCount === 1;
}
