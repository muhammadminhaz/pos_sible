import { NextResponse, type NextRequest } from "next/server";
import { clientIp, sameOrigin } from "@/lib/server/auth";
import { ADMIN_COOKIE, adminCookieOptions, adminLogin } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: "origin" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (!body || typeof body.username !== "string" || typeof body.password !== "string" || body.username.length > 100 || body.password.length > 200) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const r = await adminLogin(body.username, body.password, clientIp(req));
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: r.reason === "throttled" ? 429 : 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, r.token, adminCookieOptions());
  return res;
}
