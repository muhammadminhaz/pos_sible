"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Filter state that lives in the URL, so filtered views are shareable and survive reloads.
 * Empty values remove the param. Pass `keys` to limit which params `reset()` clears.
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(
  keys?: (keyof T & string)[],
): [T, (patch: Partial<T>) => void, () => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  const value = useMemo(() => Object.fromEntries(new URLSearchParams(qs)) as T, [qs]);

  const write = useCallback(
    (next: URLSearchParams) => {
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(qs);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, v as string);
      }
      write(next);
    },
    [qs, write],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(qs);
    for (const k of keys ?? [...next.keys()]) next.delete(k);
    write(next);
  }, [qs, keys, write]);

  return [value, set, reset];
}

/** Range filters are stored as `from~to`. */
export const encodeRange = (r?: { from: string; to: string }) => (r ? `${r.from}~${r.to}` : undefined);
export const decodeRange = (v?: string) => {
  const [from, to] = v?.split("~") ?? [];
  return from && to ? { from, to } : undefined;
};
