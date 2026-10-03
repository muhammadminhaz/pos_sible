import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { cancelSubscription } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cancels a subscription: the business's users are signed out and cannot sign in until it is renewed. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  return (await cancelSubscription(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}
