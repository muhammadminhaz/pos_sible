import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, COOKIE, cookieOptions, login, sameOrigin } from "@/lib/server/auth";
import { pool, ready } from "@/lib/server/pool";
import { createBusiness } from "@/lib/server/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  businessName: z.string().trim().min(2).max(80),
  firstName: z.string().trim().min(1).max(60),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
});

/** Opens a new business with its own data. Disabled unless POS_ALLOW_SIGNUP=true, so a private install stays private. */
export async function POST(req: NextRequest) {
  if (process.env.POS_ALLOW_SIGNUP !== "true") return NextResponse.json({ ok: false, reason: "disabled" }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: "origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { businessName, firstName, username, password } = parsed.data;
  await ready();
  const taken = await pool().query("SELECT 1 FROM logins WHERE username = $1", [username.toLowerCase()]);
  if (taken.rowCount) return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  try {
    await createBusiness({ name: businessName, admin: { username, password, firstName } });
  } catch {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  const r = await login(username, password, true, clientIp(req));
  if (!r.ok) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 500 });
  const res = NextResponse.json({ ok: true, user: r.principal.user, role: r.principal.role, businessName: r.principal.businessName });
  res.cookies.set(COOKIE, r.token, cookieOptions(r.maxAge));
  return res;
}
