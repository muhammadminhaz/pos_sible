import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MODULE_IDS } from "@/lib/server/plans";
import { requireAdmin } from "@/lib/server/adminRoute";
import { businessCode } from "@/lib/server/code";
import { contactEmail, contactPhone } from "@/lib/server/contact";
import { deleteBusiness, resetOwnerPassword, setBusinessCode, setSubscription } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const patch = z.object({
  status: z.enum(["active", "cancelled"]).optional(),
  /** What staff type at sign-in. */
  code: businessCode.optional(),
  contactEmail: contactEmail.optional(),
  contactPhone: contactPhone.optional(),
  modules: z.array(z.enum(MODULE_IDS)).optional(),
  free: z.boolean().optional(),
  /** A new password for the owner's sign-in. Passwords can be replaced from here, never read. */
  ownerPassword: z.string().min(8).max(200).optional(),
});

/** Cancel or resume, modules, contact details, business code and owner password reset: the plain account edits. Packages and end dates change only by activating or scheduling a subscription. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const { ownerPassword, code, ...subscription } = parsed.data;
  const found = await setSubscription(id, subscription);
  if (!found) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (code) {
    const r = await setBusinessCode(id, code);
    if (r === "taken") return NextResponse.json({ ok: false, reason: "code_taken" }, { status: 409 });
  }
  if (ownerPassword && !(await resetOwnerPassword(id, ownerPassword))) return NextResponse.json({ ok: false, reason: "no_owner" }, { status: 409 });
  return NextResponse.json({ ok: true });
}

/** Deletes a business for good. The body must carry the owner's username. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = z.object({ confirmUsername: z.string().min(1).max(100) }).safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !body.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const r = await deleteBusiness(id, body.data.confirmUsername);
  if (r === "not_found") return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (r === "mismatch") return NextResponse.json({ ok: false, reason: "mismatch" }, { status: 422 });
  return NextResponse.json({ ok: true });
}
