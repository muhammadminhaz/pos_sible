import { NextResponse, type NextRequest } from "next/server";
import { PLANS } from "@/lib/server/plans";
import { adminCredentials } from "@/lib/server/platform";
import { requireAdmin } from "@/lib/server/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  const { username, isDefault } = adminCredentials();
  return NextResponse.json({ ok: true, username, defaultPassword: isDefault, plans: PLANS });
}
