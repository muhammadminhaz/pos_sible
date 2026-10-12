"use client";

import { cn } from "cn";
import { useSettings } from "@/lib/data/hooks/settings";

/** The business logo when one is uploaded, otherwise the POS-sible mark: a blue tile, a folded receipt and a rising sales line (public/brand/logomark.svg, same artwork as app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  const logo = useSettings().data?.business.logo;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={cn("size-8 shrink-0 rounded-lg object-contain dark:bg-white/95 dark:p-0.5", className)} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logomark.svg" alt="" aria-hidden className={cn("block size-8 shrink-0 rounded-[25%] shadow-xs", className)} />
  );
}
