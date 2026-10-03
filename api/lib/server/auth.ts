import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Role, User } from "@/lib/data/schemas";
import type { PublicUser } from "./types";
import { pool, ready } from "./pool";
import { loadBusiness } from "./store";
import { verifyPassword } from "./passwords";
import { subscriptionState } from "./plans";

export const COOKIE = "posible_sid";
const DAY = 86_400_000;

export type Principal = { businessId: string; userId: string; user: PublicUser; role: Role; businessName: string; plan: string };
export type { PublicUser };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const publicUser = ({ password: _password, ...rest }: User): PublicUser => {
  void _password;
  return rest;
};

// --- sign-in throttling: five wrong passwords per user+address per quarter hour ---------------------------------
const fails = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60_000;
function throttled(key: string): boolean {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW) {
    fails.delete(key);
    return false;
  }
  return f.n >= 5;
}
const recordFail = (key: string) => {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > WINDOW) fails.set(key, { n: 1, first: Date.now() });
  else f.n++;
};

export type LoginResult = { ok: true; token: string; maxAge: number | null; principal: Principal } | { ok: false; reason: "invalid" | "throttled" | "cancelled" | "expired" };

export async function login(username: string, password: string, remember: boolean, ip: string): Promise<LoginResult> {
  await ready();
  const key = `${ip}|${username.trim().toLowerCase()}`;
  if (throttled(key)) return { ok: false, reason: "throttled" };

  const row = (await pool().query<{ business_id: string; user_id: string }>("SELECT business_id, user_id FROM logins WHERE username = $1", [username.trim().toLowerCase()])).rows[0];
  const loaded = row ? await loadBusiness(row.business_id) : null;
  const user = row && loaded ? loaded.db.users.find((u) => u.id === row.user_id) : undefined;
  // Same work whether or not the user exists, so timing doesn't reveal which usernames are real.
  const good = verifyPassword(password, user?.password ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!row || !loaded || !user || !good || !user.isActive || !user.allowLogin) {
    recordFail(key);
    return { ok: false, reason: "invalid" };
  }
  fails.delete(key);
  const role = loaded.db.roles.find((r) => r.id === user.roleId);
  if (!role) return { ok: false, reason: "invalid" };
  // Only someone who knows the right password learns that the subscription is the problem.
  const sub = (await pool().query<{ plan: string; subscription_status: "active" | "cancelled"; subscription_expires_at: Date | null }>("SELECT plan, subscription_status, subscription_expires_at FROM businesses WHERE id = $1", [row.business_id])).rows[0];
  const state = subscriptionState(sub.subscription_status, sub.subscription_expires_at);
  if (state !== "active") return { ok: false, reason: state };

  const token = randomBytes(32).toString("base64url");
  const ttl = remember ? 30 * DAY : DAY / 2;
  await pool().query("INSERT INTO sessions (token_hash, business_id, user_id, expires_at) VALUES ($1, $2, $3, now() + $4 * interval '1 millisecond')", [sha(token), row.business_id, row.user_id, ttl]);
  void pool().query("DELETE FROM sessions WHERE expires_at < now()").catch(() => {});
  return { ok: true, token, maxAge: remember ? ttl / 1000 : null, principal: { businessId: row.business_id, userId: user.id, user: publicUser(user), role, businessName: loaded.db.settings.business.name, plan: sub.plan } };
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await pool().query("DELETE FROM sessions WHERE token_hash = $1", [sha(token)]);
}

/** Who is making this request, or null. Re-checks the user every time, so deactivating someone ends their session at once. */
export async function authenticate(req: NextRequest | { cookies: { get(name: string): { value: string } | undefined } }): Promise<Principal | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  await ready();
  const s = (await pool().query<{ business_id: string; user_id: string; plan: string; subscription_status: "active" | "cancelled"; subscription_expires_at: Date | null }>(
    `SELECT s.business_id, s.user_id, b.plan, b.subscription_status, b.subscription_expires_at
       FROM sessions s JOIN businesses b ON b.id = s.business_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha(token)])).rows[0];
  if (!s) return null;
  // A lapsed or switched-off subscription ends the session on the very next request.
  if (subscriptionState(s.subscription_status, s.subscription_expires_at) !== "active") return null;
  const { db } = await loadBusiness(s.business_id);
  const user = db.users.find((u) => u.id === s.user_id);
  const role = user && db.roles.find((r) => r.id === user.roleId);
  if (!user || !role || !user.isActive || !user.allowLogin) return null;
  return { businessId: s.business_id, userId: user.id, user: publicUser(user), role, businessName: db.settings.business.name, plan: s.plan };
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

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
