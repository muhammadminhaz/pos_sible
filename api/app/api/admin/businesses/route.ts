import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MODULE_IDS } from "@/lib/server/plans";
import { requireAdmin } from "@/lib/server/adminRoute";
import { businessCode, defaultCode } from "@/lib/server/code";
import { contactEmail, contactPhone } from "@/lib/server/contact";
import { getPlans, listBusinesses, setSubscription } from "@/lib/server/platform";
import { pool, ready } from "@/lib/server/pool";
import { createBusiness } from "@/lib/server/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every business with its package, user count and storage. Totals only: no business records are ever returned. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, false);
  if (denied) return denied;
  return NextResponse.json({ ok: true, businesses: await listBusinesses() });
}

const create = z.object({
  businessName: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
  /** What staff type at sign-in; defaults to the owner's username. */
  code: businessCode.optional(),
  email: contactEmail.optional(),
  phone: contactPhone.optional(),
  plan: z.string().min(1).max(40),
  modules: z.array(z.enum(MODULE_IDS)).optional(),
  free: z.boolean().optional(),
});

/** Opens a business account: its name, the sign-in the owner will use, and a package. It cannot sign in until a subscription is activated. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { businessName, username, password, code, plan, email, phone, modules, free } = parsed.data;
  await ready();
  if (!(await getPlans()).some((p) => p.id === plan)) return NextResponse.json({ ok: false, reason: "invalid", fields: { plan: ["unknown"] } }, { status: 400 });
  // Owners sign in with just their username, so that must be free everywhere; staff names only need to be free inside their business.
  if ((await pool().query("SELECT 1 FROM logins WHERE username = $1 AND user_id = 'user_admin'", [username.toLowerCase()])).rowCount) {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  if ((await pool().query("SELECT 1 FROM businesses WHERE code = $1", [code ?? defaultCode(username)])).rowCount) {
    return NextResponse.json({ ok: false, reason: "code_taken" }, { status: 409 });
  }
  let businessId: string;
  try {
    ({ businessId } = await createBusiness({ name: businessName, admin: { username, password, firstName: businessName }, code, plan }));
  } catch {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  // A new account has not paid yet: it stays switched off until the platform owner activates it (a free one needs no payment).
  await setSubscription(businessId, { status: "active", expiresAt: free ? null : new Date().toISOString(), contactEmail: email ?? null, contactPhone: phone ?? null, modules, free });
  return NextResponse.json({ ok: true, id: businessId }, { status: 201 });
}
