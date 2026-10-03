import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, logout, sameOrigin } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  await logout(req.cookies.get(COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
