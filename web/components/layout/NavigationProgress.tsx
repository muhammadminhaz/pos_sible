"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/** Waits this long before showing anything, so an instant navigation never flashes a spinner. */
const SHOW_AFTER_MS = 60;
/** Give up (and hide) if a navigation never completes, e.g. it failed or was cancelled. */
const GIVE_UP_MS = 15_000;

/**
 * From the moment an in-app link is pressed until the next screen is there, a thin bar sweeps left to right along the
 * top edge of the window. Nothing else on the page changes, so navigating never looks frozen.
 */
export function NavigationProgress() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const giveUp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The new screen arrived.
  useEffect(() => {
    clearTimeout(showTimer.current);
    clearTimeout(giveUp.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the route changed, so the wait is over
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      clearTimeout(showTimer.current);
      clearTimeout(giveUp.current);
      showTimer.current = setTimeout(() => setPending(true), SHOW_AFTER_MS);
      giveUp.current = setTimeout(() => setPending(false), GIVE_UP_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(showTimer.current);
      clearTimeout(giveUp.current);
    };
  }, []);

  if (!pending) return null;
  return (
    <div role="progressbar" aria-busy="true" aria-label={t("loadingData")} className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-primary/15">
      <div className="route-sweep h-full w-2/5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
    </div>
  );
}
