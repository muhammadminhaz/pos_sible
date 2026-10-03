import { NextResponse, type NextRequest } from "next/server";
import { adminCredentials, getPlans } from "@/lib/server/platform";
import { requireAdmin } from "@/lib/server/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  return NextResponse.json({ ok: true, username: adminCredentials().username, plans: await getPlans() });
}
