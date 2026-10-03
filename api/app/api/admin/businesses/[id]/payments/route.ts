import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { listPayments } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The payments recorded for one business: date, amount, transaction id, and whether a proof image is stored. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  return NextResponse.json({ ok: true, payments: await listPayments(id) });
}
