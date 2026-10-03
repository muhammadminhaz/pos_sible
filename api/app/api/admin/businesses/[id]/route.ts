import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { setSubscription } from "@/lib/server/platform";
import { PLAN_IDS } from "@/lib/server/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patch = z.object({
  plan: z.enum(PLAN_IDS as [string, ...string[]]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});
const uuid = z.string().uuid();

/** Package, on/off switch and end date: the only things the platform owner can change about a business. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const found = await setSubscription(id, parsed.data as Parameters<typeof setSubscription>[1]);
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}
