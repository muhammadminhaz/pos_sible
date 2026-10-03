"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRangeContext } from "@/components/shared/DateRangePicker";
import { presetRange } from "@/lib/domain/dateRanges";

/**
 * Filter state that lives in the URL, so filtered views are shareable and survive reloads.
 * Empty values remove the param. Pass `keys` to limit which params `reset()` clears.
 * A screen with a `range` filter opens on "This month" (once, when it has no range yet), and the chip can still be cleared.
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(
  keys?: (keyof T & string)[],
  opts: { autoRange?: boolean } = {},
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

  const { today, fyStartMonth } = useRangeContext();
  const seeded = useRef(false);
  const wantsRange = opts.autoRange !== false && (keys as string[] | undefined)?.includes("range");
  useEffect(() => {
    if (!wantsRange || seeded.current) return;
    seeded.current = true;
    if (!new URLSearchParams(qs).get("range")) set({ range: encodeRange(presetRange("thisMonth", today, fyStartMonth)) } as unknown as Partial<T>);
  }, [wantsRange, qs, set, today, fyStartMonth]);

  return [value, set, reset];
}

/** Range filters are stored as `from~to`. */
export const encodeRange = (r?: { from: string; to: string }) => (r ? `${r.from}~${r.to}` : undefined);
export const decodeRange = (v?: string) => {
  const [from, to] = v?.split("~") ?? [];
  return from && to ? { from, to } : undefined;
};
