"use client";

import { cn } from "cn";
import { useSettings } from "@/lib/data/hooks/settings";

/** The business logo when one is uploaded, otherwise the POS-sible mark: a blue tile with a register, a growth line, a receipt and a taka coin (public/brand/logomark.svg). */
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
    <img src="/brand/logomark.svg" alt="" aria-hidden className={cn("block size-8 shrink-0 rounded-[22%] shadow-xs", className)} />
  );
}
