"use client";

import { cn } from "cn";
import { useSettings } from "@/lib/data/hooks/settings";

/** The business logo when one is uploaded, otherwise the pos_sible mark: an indigo square with a receipt tear. */
export function LogoMark({ className }: { className?: string }) {
  const logo = useSettings().data?.business.logo;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={cn("size-8 shrink-0 rounded-lg object-contain dark:bg-white/95 dark:p-0.5", className)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground", className)}
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 20z" />
        <path d="M9.5 8h5M9.5 12h5" />
      </svg>
    </span>
  );
}
