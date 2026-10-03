import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await authenticate(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user: me.user, role: me.role, businessName: me.businessName, businessCode: me.businessCode, modules: me.modules });
}
