"use client";

import { useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";
import { DEMO } from "@/lib/data/api/mode";
import { exitDemo } from "@/lib/demo";

const HIDDEN_KEY = "posible:demo:banner-hidden";

function readHidden(): boolean {
  try {
    return sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Tells a demo visitor their changes are private and temporary, with a way out. Closing it hides it for the rest of this demo tab. */
export function DemoBanner() {
  const [hidden, setHidden] = useState(() => DEMO && readHidden());
  if (!DEMO || hidden) return null;

  const close = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch { /* storage blocked: hidden until the next load */ }
  };

  return (
    <div role="status" className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-info-soft py-2 pr-11 pl-4 text-center text-[13px] text-info-foreground">
      <span className="inline-flex items-center gap-1.5">
        <SparklesIcon aria-hidden className="size-3.5" />
        You&apos;re exploring a demo shop. Changes stay in this browser tab and reset when you leave.
      </span>
      <button type="button" onClick={() => void exitDemo()} className="rounded-md px-2 py-0.5 font-medium underline underline-offset-2 hover:bg-info/10">
        Exit demo
      </button>
      <button type="button" onClick={close} aria-label="Close demo message" className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md hover:bg-info/10 focus-visible:ring-2 focus-visible:ring-info/50 focus-visible:outline-none">
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
