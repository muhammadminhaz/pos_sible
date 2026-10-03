"use client";

import { useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";

/**
 * Prints a report page. The global print CSS hides everything except a `[data-print-root]` portal, so the page body is
 * rendered into one, in light colours, then the print dialog opens.
 */
export function useReportPrint() {
  const [printing, setPrinting] = useState(false);
  const print = () => {
    flushSync(() => setPrinting(true));
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    window.addEventListener("afterprint", () => {
      if (wasDark) root.classList.add("dark");
      setPrinting(false);
    }, { once: true });
    window.print();
  };
  return { printing, print };
}

export function PrintPortal({ printing, children }: { printing: boolean; children: ReactNode }) {
  if (!printing) return null;
  return createPortal(<div data-print-root="a4" className="bg-white p-4 text-[12px] text-neutral-900">{children}</div>, document.body);
}
