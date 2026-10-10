"use client";

import { SparklesIcon } from "lucide-react";
import { DEMO } from "@/lib/data/api/mode";
import { exitDemo } from "@/lib/demo";

/** Tells a demo visitor their changes are private and temporary, with a way out. */
export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-info-soft px-4 py-2 text-center text-[13px] text-info-foreground">
      <span className="inline-flex items-center gap-1.5">
        <SparklesIcon aria-hidden className="size-3.5" />
        You&apos;re exploring a demo shop. Changes stay in this browser tab and reset when you leave.
      </span>
      <button type="button" onClick={() => void exitDemo()} className="rounded-md px-2 py-0.5 font-medium underline underline-offset-2 hover:bg-info/10">
        Exit demo
      </button>
    </div>
  );
}
