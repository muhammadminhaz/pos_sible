import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/adminRoute";
import { listBusinesses, setSubscription } from "@/lib/server/platform";
import { PLAN_IDS } from "@/lib/server/plans";
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
  ownerName: z.string().trim().min(1).max(60),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
  plan: z.enum(PLAN_IDS as [string, ...string[]]),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

/** Opens a business account with its first sign-in and package. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { businessName, ownerName, username, password, plan, expiresAt } = parsed.data;
  await ready();
  if ((await pool().query("SELECT 1 FROM logins WHERE username = $1", [username.toLowerCase()])).rowCount) {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  let businessId: string;
  try {
    ({ businessId } = await createBusiness({ name: businessName, admin: { username, password, firstName: ownerName } }));
  } catch {
    return NextResponse.json({ ok: false, reason: "username_taken" }, { status: 409 });
  }
  await setSubscription(businessId, { plan: plan as (typeof PLAN_IDS)[number], status: "active", expiresAt: expiresAt ?? null });
  return NextResponse.json({ ok: true, id: businessId }, { status: 201 });
}
