import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/adminRoute";
import { subscriptionHistory } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The subscription history across every business: each activation with its payment, and each cancellation. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  return NextResponse.json({ ok: true, history: await subscriptionHistory() });
}
