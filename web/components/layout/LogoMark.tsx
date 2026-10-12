"use client";

import { cn } from "cn";
import { useSettings } from "@/lib/data/hooks/settings";

/** The business logo when one is uploaded, otherwise the POS-sible mark: an indigo tile, a receipt, and a rising sales line (same artwork as app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  const logo = useSettings().data?.business.logo;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={cn("size-8 shrink-0 rounded-lg object-contain dark:bg-white/95 dark:p-0.5", className)} />
    );
  }
  return (
    <span aria-hidden className={cn("block size-8 shrink-0 overflow-hidden rounded-[22%] shadow-xs", className)}>
      <svg viewBox="0 0 64 64" className="size-full">
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#logo-bg)" />
        <path d="M16 11h32a2 2 0 0 1 2 2v39l-4.5-3.2-4.5 3.2-4.5-3.2-4.5 3.2-4.5-3.2-4.5 3.2-1.5-1V13a2 2 0 0 1 2-2z" fill="#fff" />
        <path d="M20 40l7-8 6 5 10-13" fill="none" stroke="#4f46e5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="43" cy="24" r="3.1" fill="#10b981" />
        <path d="M20 21h12" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
