"use client";

import { useEffect } from "react";

/**
 * Feeds the pointer position to any element marked `data-spotlight`, so its CSS can draw a soft light under the cursor.
 * One listener for the whole app; does nothing for touch and does nothing visible with reduced motion.
 */
export function MicroInteractions() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-spotlight]");
      if (!el) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    const root = document.documentElement;
    const mark = (e: PointerEvent) => {
      root.style.setProperty("--click-x", `${e.clientX}px`);
      root.style.setProperty("--click-y", `${e.clientY}px`);
    };
    const clearMark = () => {
      root.style.removeProperty("--click-x");
      root.style.removeProperty("--click-y");
    };
    document.addEventListener("pointerdown", mark, { passive: true, capture: true });
    document.addEventListener("keydown", clearMark, { passive: true, capture: true });
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", mark, { capture: true });
      document.removeEventListener("keydown", clearMark, { capture: true });
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
