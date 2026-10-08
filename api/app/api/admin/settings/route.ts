import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { setCurrency } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ currency: z.string().refine((c) => Intl.supportedValuesOf("currency").includes(c)) });

/** The currency every package price and subscription payment is shown in. Relabels amounts, never converts them. */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  await setCurrency(parsed.data.currency);
  return NextResponse.json({ ok: true });
}
