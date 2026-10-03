import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "./auth";
import { isAdmin } from "./platform";

/** Shared guard for the platform admin endpoints: right origin for writes, and a valid admin session. */
export async function requireAdmin(req: NextRequest, write: boolean): Promise<NextResponse | null> {
  if (write && !sameOrigin(req)) return NextResponse.json({ ok: false, reason: "origin" }, { status: 403 });
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  return null;
}
