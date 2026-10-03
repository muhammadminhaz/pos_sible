import { NextResponse, type NextRequest } from "next/server";
import { clientIp, COOKIE, cookieOptions, login, sameOrigin } from "@/lib/server/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: "origin" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown; remember?: unknown; business?: unknown } | null;
  if (!body || typeof body.username !== "string" || typeof body.password !== "string" || body.username.length > 100 || body.password.length > 200 || (body.business !== undefined && (typeof body.business !== "string" || body.business.length > 100))) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const r = await login(body.username, body.password, body.remember !== false, clientIp(req), (body.business as string | undefined) || undefined);
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: r.reason === "throttled" ? 429 : r.reason === "cancelled" || r.reason === "expired" ? 403 : 401 });
  const res = NextResponse.json({ ok: true, user: r.principal.user, role: r.principal.role, businessName: r.principal.businessName, businessCode: r.principal.businessCode, modules: r.principal.modules });
  res.cookies.set(COOKIE, r.token, cookieOptions(r.maxAge));
  return res;
}
