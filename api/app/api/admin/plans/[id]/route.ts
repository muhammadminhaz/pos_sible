import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { planFields } from "@/lib/server/planInput";
import { deletePlan, updatePlan } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patch = z.object(planFields).partial();
type Ctx = { params: Promise<{ id: string }> };

/** Edit a package: name, price, term length, user limit, modules, or what it says it includes. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  return (await updatePlan(id, parsed.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
}

/** Delete a package that no business is on or scheduled to move to. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const r = await deletePlan((await ctx.params).id);
  if (r === "deleted") return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, reason: r }, { status: r === "not_found" ? 404 : 409 });
}
