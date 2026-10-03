import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { planFields } from "@/lib/server/planInput";
import { createPlan } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const create = z.object({ ...planFields, maxUsers: planFields.maxUsers.default(null), description: planFields.description.default(""), benefits: planFields.benefits.default([]) });

/** Adds a package. There is no limit on how many the platform owner can have. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  return NextResponse.json({ ok: true, plan: await createPlan(parsed.data) }, { status: 201 });
}
