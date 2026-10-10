import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, sameOrigin } from "@/lib/server/auth";
import { joinWaitlist, waitlistEmail } from "@/lib/server/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: waitlistEmail });

/** Public: the home page's "Join the waitlist" form. Throttled per IP. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: "origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  try {
    const r = await joinWaitlist(parsed.data.email, clientIp(req));
    if (r === "throttled") return NextResponse.json({ ok: false, reason: "throttled" }, { status: 429 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waitlist join failed", e);
    return NextResponse.json({ ok: false, reason: "server" }, { status: 500 });
  }
}
