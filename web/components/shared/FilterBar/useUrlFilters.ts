"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Filter state that lives in the URL, so filtered views are shareable and survive reloads.
 * Empty values remove the param. Pass `keys` to limit which params `reset()` clears.
 * Date ranges are opt-in: a page opens unfiltered until the user chooses a range.
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(
  keys?: (keyof T & string)[],
): [T, (patch: Partial<T>) => void, () => void] {
  const params = useSearchParams();
  const qs = params.toString();

  const value = useMemo(() => Object.fromEntries(new URLSearchParams(qs)) as T, [qs]);

  // ponytail: replaceState, not router.replace, so a filter change only refetches the table and never re-runs the page.
  const write = useCallback((next: URLSearchParams) => {
    const s = next.toString();
    if (s === window.location.search.slice(1)) return;
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, []);

  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, v as string);
      }
      write(next);
    },
    [write],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    for (const k of keys ?? [...next.keys()]) next.delete(k);
    write(next);
  }, [keys, write]);

  return [value, set, reset];
}

/** Range filters are stored as `from~to`. */
export const encodeRange = (r?: { from: string; to: string }) => (r ? `${r.from}~${r.to}` : undefined);
export const decodeRange = (v?: string) => {
  const [from, to] = v?.split("~") ?? [];
  return from && to ? { from, to } : undefined;
};
