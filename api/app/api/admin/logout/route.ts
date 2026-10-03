import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { ADMIN_COOKIE, adminLogout } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  await adminLogout(req.cookies.get(ADMIN_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
