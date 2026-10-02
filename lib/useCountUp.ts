"use client";

import { useEffect, useRef, useState } from "react";

/** Eases a number from its previous value to `target`. Returns `target` straight away when motion is reduced. */
export function useCountUp(target: number | null | undefined, ms = 700): number | null {
  const [value, setValue] = useState<number | null>(target ?? null);
  const from = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return target == null ? null : value;
}
