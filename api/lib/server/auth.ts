import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Role, User } from "@/lib/data/schemas";
import type { PublicUser } from "./types";
import { pool, ready } from "./pool";
import { loadBusiness } from "./store";
import { clearFails, recordFail, throttled } from "./throttle";
import { verifyPassword } from "./passwords";
import { effectiveModules, subscriptionState, type ModuleId } from "./plans";

export const COOKIE = "posible_sid";
const DAY = 86_400_000;

export type Principal = { businessId: string; userId: string; user: PublicUser; role: Role; businessName: string; /** What staff type to reach this business. */ businessCode: string; plan: string; modules: ModuleId[] };
export type { PublicUser };

/** What one person can use: the business's modules, narrowed to the ones the owner gave them (none chosen = all). */
const userModules = (business: ModuleId[], user: User): ModuleId[] => (user.modules?.length ? business.filter((m) => user.modules.includes(m)) : business);

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const publicUser = ({ password: _password, ...rest }: User): PublicUser => {
  void _password;
  return rest;
};

// --- sign-in throttling ---------------------------------------------------------------------------------------
// Five wrong passwords per user+address per quarter hour, and ACCOUNT_LIMIT per account from any address, so faking a
// new address on every try can't buy unlimited guesses. Counters live in Postgres (lib/server/throttle.ts).
const WINDOW = 15 * 60_000;
export const ACCOUNT_LIMIT = 20;

export type LoginResult = { ok: true; token: string; maxAge: number | null; principal: Principal } | { ok: false; reason: "invalid" | "throttled" | "cancelled" | "expired" };

/**
 * Signs in. Staff give the `business` code of the business they work for, and their username is looked up inside it, so
 * the same username can exist in many businesses. Without a code only a business owner's username is looked up.
 */
export async function login(username: string, password: string, remember: boolean, ip: string, business?: string): Promise<LoginResult> {
  await ready();
  const code = business?.trim().toLowerCase();
  const key = `${ip}|${code ?? ""}|${username.trim().toLowerCase()}`;
  const account = `account|${code ?? ""}|${username.trim().toLowerCase()}`;
  if ((await throttled(key, 5, WINDOW)) || (await throttled(account, ACCOUNT_LIMIT, WINDOW))) return { ok: false, reason: "throttled" };

  const name = username.trim().toLowerCase();
  const row = (await pool().query<{ business_id: string; user_id: string }>(
    code
      ? "SELECT l.business_id, l.user_id FROM logins l JOIN businesses b ON b.id = l.business_id WHERE b.code = $1 AND l.username = $2"
      : "SELECT business_id, user_id FROM logins WHERE username = $2 AND user_id = 'user_admin' AND $1::text IS NULL",
    [code ?? null, name],
  )).rows[0];
  const loaded = row ? await loadBusiness(row.business_id) : null;
  const user = row && loaded ? loaded.db.users.find((u) => u.id === row!.user_id) : undefined;
  // Same work whether or not the user exists, so timing doesn't reveal which usernames are real.
  const good = verifyPassword(password, user?.password ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!row || !loaded || !user || !good || !user.isActive || !user.allowLogin) {
    await recordFail(key, WINDOW);
    await recordFail(account, WINDOW);
    return { ok: false, reason: "invalid" };
  }
  await clearFails(key, account);
  const role = loaded.db.roles.find((r) => r.id === user.roleId);
  if (!role) return { ok: false, reason: "invalid" };
  // Only someone who knows the right password learns that the subscription is the problem.
  const sub = (await pool().query<{ plan: string; subscription_status: "active" | "cancelled"; subscription_expires_at: Date | null; modules: string[] | null; free: boolean; code: string; plan_modules: string[] }>("SELECT b.plan, b.code, b.subscription_status, b.subscription_expires_at, b.modules, b.free, p.modules AS plan_modules FROM businesses b JOIN plans p ON p.id = b.plan WHERE b.id = $1", [row.business_id])).rows[0];
  const state = subscriptionState(sub.subscription_status, sub.subscription_expires_at, new Date(), sub.free);
  if (state !== "active") return { ok: false, reason: state };

  const token = randomBytes(32).toString("base64url");
  const ttl = remember ? 30 * DAY : DAY / 2;
  await pool().query("INSERT INTO sessions (token_hash, business_id, user_id, expires_at) VALUES ($1, $2, $3, now() + $4 * interval '1 millisecond')", [sha(token), row.business_id, row.user_id, ttl]);
  void pool().query("DELETE FROM sessions WHERE expires_at < now()").catch(() => {});
  return { ok: true, token, maxAge: remember ? ttl / 1000 : null, principal: { businessId: row.business_id, userId: user.id, user: publicUser(user), role, businessName: loaded.db.settings.business.name, businessCode: sub.code, plan: sub.plan, modules: userModules(effectiveModules(sub.modules, sub.free, sub.plan_modules), user) } };
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await pool().query("DELETE FROM sessions WHERE token_hash = $1", [sha(token)]);
}

/** Who is making this request, or null. Re-checks the user every time, so deactivating someone ends their session at once. */
export async function authenticate(req: NextRequest | { cookies: { get(name: string): { value: string } | undefined } }): Promise<Principal | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  await ready();
  const s = (await pool().query<{ business_id: string; user_id: string; plan: string; subscription_status: "active" | "cancelled"; subscription_expires_at: Date | null; modules: string[] | null; free: boolean; code: string; plan_modules: string[] }>(
    `SELECT s.business_id, s.user_id, b.code, b.plan, b.subscription_status, b.subscription_expires_at, b.modules, b.free, p.modules AS plan_modules
       FROM sessions s JOIN businesses b ON b.id = s.business_id JOIN plans p ON p.id = b.plan
      WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha(token)])).rows[0];
  if (!s) return null;
  // A lapsed or switched-off subscription ends the session on the very next request.
  if (subscriptionState(s.subscription_status, s.subscription_expires_at, new Date(), s.free) !== "active") return null;
  const { db } = await loadBusiness(s.business_id);
  const user = db.users.find((u) => u.id === s.user_id);
  const role = user && db.roles.find((r) => r.id === user.roleId);
  if (!user || !role || !user.isActive || !user.allowLogin) return null;
  return { businessId: s.business_id, userId: user.id, user: publicUser(user), role, businessName: db.settings.business.name, businessCode: s.code, plan: s.plan, modules: userModules(effectiveModules(s.modules, s.free, s.plan_modules), user) };
}

export function cookieOptions(maxAge: number | null) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", ...(maxAge ? { maxAge } : {}) };
}

/** Exact browser origins (scheme + host) allowed to call this API, e.g. the web project that proxies to it. */
const allowedOrigins = () => (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);

/** Browsers send Origin on cross-site POSTs; refuse anything that isn't this site or an allowed web origin. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers omit it; SameSite=Lax still covers them
  if (allowedOrigins().includes(origin)) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/**
 * The caller's address for throttling. The left of x-forwarded-for is whatever the caller sent, so it can't be trusted;
 * each proxy appends the address it saw on the right. TRUSTED_PROXY_HOPS (default 1) is how many entries from the
 * right were written by your own proxies, i.e. which one is the first address they vouch for.
 */
export function clientIp(req: Pick<NextRequest, "headers">): string {
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!chain.length) return req.headers.get("x-real-ip")?.trim() || "local";
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS) || 1));
  return chain[Math.max(0, chain.length - hops)];
}
