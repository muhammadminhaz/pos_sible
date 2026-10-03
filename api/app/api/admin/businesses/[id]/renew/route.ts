import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { renewSubscription } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `amount` is what was actually received; leave it out to record the list price, send 0 to record nothing. */
const body = z.object({ months: z.number().int().min(1).max(60), amount: z.number().min(0).max(1e9).optional() });

/** Renews a subscription for a number of months and switches the business back on. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const expiresAt = await renewSubscription(id, parsed.data.months, parsed.data.amount);
  return expiresAt ? NextResponse.json({ ok: true, expiresAt }) : NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}
