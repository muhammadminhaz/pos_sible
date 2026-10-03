import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { updateModulePrice } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patch = z.object({ priceMonthly: z.number().min(0).max(100_000_000) });

/** Change what a module adds to a business's monthly price. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  return (await updateModulePrice(id, parsed.data.priceMonthly)) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}
