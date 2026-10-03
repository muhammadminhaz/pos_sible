import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/adminRoute";
import { paymentProof } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The proof image kept with a payment. Only the stored raster types are ever served, and never as anything else. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  const proof = Number.isSafeInteger(id) && id > 0 ? await paymentProof(id) : null;
  if (!proof) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(proof.data), { headers: { "content-type": proof.type, "x-content-type-options": "nosniff", "cache-control": "private, max-age=3600", "content-security-policy": "default-src 'none'" } });
}
