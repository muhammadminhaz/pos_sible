import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { setCurrency } from "@/lib/server/platform";
import { refreshRatesIfStale } from "@/lib/server/rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ currency: z.string().refine((c) => Intl.supportedValuesOf("currency").includes(c)) });

/** The currency every package price and subscription payment is shown in. Stored amounts keep their own currency; they are converted for display. */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  await setCurrency(parsed.data.currency);
  await refreshRatesIfStale().catch(() => {}); // first switch on a fresh install, before the job has run
  return NextResponse.json({ ok: true });
}
