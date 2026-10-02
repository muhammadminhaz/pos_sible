import { NextResponse, type NextRequest } from "next/server";
import { authenticate, sameOrigin } from "@/lib/server/auth";
import { handleRpc } from "@/lib/server/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 30 * 1024 * 1024; // a full-database restore is the largest legitimate request

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: { name: "Error", code: "forbidden_origin", message: "Cross-site request refused." } }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return NextResponse.json({ ok: false, error: { name: "Error", code: "too_large", message: "Request too large." } }, { status: 413 });
  const me = await authenticate(req);
  if (!me) return NextResponse.json({ ok: false, error: { name: "AppError", code: "unauthorized", message: "Please sign in." } }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { name: "AppError", code: "bad_request", message: "Malformed request" } }, { status: 400 });
  }
  const res = await handleRpc(me, body);
  return NextResponse.json(res, { status: res.ok || res.error.code !== "internal" ? 200 : 500 });
}
