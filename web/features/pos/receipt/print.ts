"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

export type PrintKind = "thermal" | "a4" | "labels";

/**
 * Renders the chosen layout into the print root synchronously, then opens the print dialog.
 * The root is cleared on `afterprint`.
 */
export function usePrint() {
  const [printing, setPrinting] = useState<PrintKind | null>(null);
  const print = (kind: PrintKind) => {
    flushSync(() => setPrinting(kind));
    window.addEventListener("afterprint", () => setPrinting(null), { once: true });
    window.print();
  };
  return { printing, print };
}
