import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { contactEmail, contactPhone } from "@/lib/server/contact";
import { deleteBusiness, getPlans, resetOwnerPassword, setSubscription } from "@/lib/server/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const patch = z.object({
  plan: z.string().min(1).max(40).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  contactEmail: contactEmail.optional(),
  contactPhone: contactPhone.optional(),
  /** A new password for the owner's sign-in. Passwords can be replaced from here, never read. */
  ownerPassword: z.string().min(8).max(200).optional(),
});

/** Package, on/off switch, end date and owner password reset: the only things the platform owner can change about a business. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const { ownerPassword, ...subscription } = parsed.data;
  if (subscription.plan && !(await getPlans()).some((p) => p.id === subscription.plan)) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const found = await setSubscription(id, subscription as Parameters<typeof setSubscription>[1]);
  if (!found) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
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
