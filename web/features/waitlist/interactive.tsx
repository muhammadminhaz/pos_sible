"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { API_MODE, DEMO } from "@/lib/data/api/mode";

/** Browser-only builds keep the session in the browser, so a signed-in visitor is sent on to the app once it has loaded. Not a /demo visitor: they are only looking around. */
export function SignedInRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (API_MODE || DEMO) return;
    let off = () => {};
    void import("@/lib/auth/session").then(({ useSession }) => {
      const go = () => useSession.getState().userId && router.replace("/home");
      if (useSession.persist.hasHydrated()) go();
      else off = useSession.persist.onFinishHydration(go);
    });
    return () => off();
  }, [router]);
  return null;
}

type WaitlistState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; email: string };

const WAITLIST_ERRORS: Record<string, string> = {
  invalid: "That email doesn't look right. Check it and try again.",
  throttled: "Too many tries from this network. Please wait a bit and try again.",
};
const WAITLIST_FALLBACK = "We couldn't save your email just now. Please try again in a moment.";

/** Email form for the pre-launch waitlist; posts to the API's /api/waitlist. */
export function WaitlistForm() {
  const [state, setState] = useState<WaitlistState>({ kind: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email || !form.checkValidity()) return setState({ kind: "error", message: WAITLIST_ERRORS.invalid });
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (res.ok && body?.ok) return setState({ kind: "done", email });
      setState({ kind: "error", message: WAITLIST_ERRORS[body?.reason ?? ""] ?? WAITLIST_FALLBACK });
    } catch {
      setState({ kind: "error", message: WAITLIST_FALLBACK });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="wl-glass flex items-center gap-3 rounded-2xl px-4 py-4 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><CheckIcon aria-hidden className="size-5" /></span>
        <p className="text-sm text-white/85">
          <span className="block font-medium text-white">You&apos;re on the list.</span>
          We&apos;ll email <span className="font-medium text-white">{state.email}</span> the day early access opens.
        </p>
      </div>
    );
  }

  const loading = state.kind === "loading";
  const error = state.kind === "error" ? state.message : "";
  return (
    <form onSubmit={submit} noValidate aria-describedby="waitlist-note">
      <div className={cn("wl-glass flex items-center gap-1.5 rounded-2xl p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-indigo-300/60", error && "ring-1 ring-rose-400/60")}>
        <label htmlFor="waitlist-email" className="sr-only">Email address</label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@yourshop.com"
          aria-invalid={!!error || undefined}
          aria-errormessage={error ? "waitlist-error" : undefined}
          onInput={() => error && setState({ kind: "idle" })}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-white/45"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#0b0b1a] shadow-[0_8px_30px_-6px_rgb(165_180_252/0.7)] transition-[transform,background-color] hover:bg-indigo-50 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
        >
          {loading && <Loader2Icon aria-hidden className="size-4 animate-spin" />}
          {loading ? "Joining" : "Join waitlist"}
        </button>
      </div>
      <p id="waitlist-error" aria-live="polite" className="mt-3 min-h-5 text-sm text-rose-300">{error}</p>
      <p id="waitlist-note" className="text-[13px] text-white/60">One email when we open. Nothing else.</p>
    </form>
  );
}
