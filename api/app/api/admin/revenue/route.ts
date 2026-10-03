import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/adminRoute";
import { revenueReport } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscription money received: totals, the last 12 months, by package, and the latest payments. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ...(await revenueReport()) });
}
