import { AppError, deserializeError, type WireError } from "@/lib/data/errors";

/** Called when the server says the session is gone, so the UI can send the user to sign in. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => void (onUnauthorized = fn);

export async function rpcCall(service: string, method: string, args: unknown[]): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch("/api/rpc", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ service, method, args }),
    });
  } catch {
    throw new AppError("The server can't be reached. Check your connection.", "network");
  }
  if (res.status === 401) {
    onUnauthorized();
    throw new AppError("Please sign in again.", "unauthorized");
  }
  let body: { ok: boolean; result?: unknown; error?: WireError };
  try {
    body = await res.json();
  } catch {
    throw new AppError("The server sent something unexpected.", "bad_response");
  }
  if (body.ok) return body.result ?? undefined;
  throw deserializeError(body.error ?? { name: "Error", code: "internal", message: "Something went wrong." });
}
