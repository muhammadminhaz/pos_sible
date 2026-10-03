import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
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
  plan: z.string().min(1).max(40),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

/** Opens a business account: its name, the sign-in the owner will use, and a package. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { businessName, username, password, plan, expiresAt } = parsed.data;
  await ready();
  if (!(await getPlans()).some((p) => p.id === plan)) return NextResponse.json({ ok: false, reason: "invalid", fields: { plan: ["unknown"] } }, { status: 400 });
  if ((await pool().query("SELECT 1 FROM logins WHERE username = $1", [username.toLowerCase()])).rowCount) {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  let businessId: string;
  try {
    ({ businessId } = await createBusiness({ name: businessName, admin: { username, password, firstName: businessName } }));
  } catch {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  await setSubscription(businessId, { plan, status: "active", expiresAt: expiresAt ?? null });
  return NextResponse.json({ ok: true, id: businessId }, { status: 201 });
}
