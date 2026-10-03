import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { updatePlan } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patch = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  maxUsers: z.number().int().min(1).max(100000).nullable().optional(),
  priceMonthly: z.number().min(0).max(100_000_000).optional(),
});

/** Rename a package, change its user limit or its monthly price. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  return (await updatePlan(id, parsed.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}
