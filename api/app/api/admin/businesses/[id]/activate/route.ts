import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { activateSubscription, MAX_PROOF_BYTES, PROOF_TYPES } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields = z.object({
  terms: z.coerce.number().int().min(1).max(60),
  plan: z.string().min(1).max(80).optional(),
  restart: z.enum(["true", "false"]).optional(),
  /** What was actually received; leave out for the package price times the terms, send 0 to record nothing. */
  amount: z.coerce.number().min(0).max(1e9).optional(),
  reference: z.string().trim().max(120).optional(),
});

/** The type of an image judged by its first bytes, never by what the browser claims. */
function sniff(b: Buffer): (typeof PROOF_TYPES)[number] | null {
  if (b.length > 12 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/**
 * Activates a subscription after payment was received: one more term (or terms) of the package, the payment dated now
 * with its transaction id and an optional proof image. Sent as a form so the image can ride along.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  if (!form || !z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const raw = Object.fromEntries([...form.entries()].filter(([k, v]) => k !== "proof" && typeof v === "string" && v !== ""));
  const parsed = fields.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid", fields: parsed.error.flatten().fieldErrors }, { status: 400 });

  let proof: { data: Buffer; type: string } | undefined;
  const file = form.get("proof");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PROOF_BYTES) return NextResponse.json({ ok: false, reason: "proof_too_large" }, { status: 413 });
    const data = Buffer.from(await file.arrayBuffer());
    const type = sniff(data);
    if (!type) return NextResponse.json({ ok: false, reason: "proof_type" }, { status: 415 });
    proof = { data, type };
  }

  const { restart, ...rest } = parsed.data;
  const r = await activateSubscription(id, { ...rest, restart: restart === "true", proof });
  if (r.ok) return NextResponse.json({ ok: true, expiresAt: r.expiresAt, paymentId: r.paymentId });
  return NextResponse.json({ ok: false, reason: r.reason }, { status: r.reason === "not_found" ? 404 : r.reason === "proof_required" ? 422 : 400 });
}
