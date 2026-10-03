import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { scheduleChange } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ plan: z.string().min(1).max(80).nullable() });

/** Upgrade or downgrade when the current term ends: the package applies at the next activation. `plan: null` clears it. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const r = await scheduleChange(id, parsed.data.plan);
  return r === "ok" ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, reason: r }, { status: r === "not_found" ? 404 : 400 });
}
