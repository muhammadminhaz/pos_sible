"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_MODE } from "@/lib/data/api/mode";

/** Demo mode keeps the session in the browser, so a signed-in visitor is sent on to the app once it has loaded. */
export function SignedInRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (API_MODE) return;
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
