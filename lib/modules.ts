import type { Settings } from "@/lib/data/schemas";

type ModuleKey = keyof Settings["modules"];

/** Which module switch controls a route; unlisted routes are always on. Longest prefix wins. */
const PREFIXES: [string, ModuleKey][] = [
  ["/purchases", "purchases"],
  ["/sales/new", "addSale"],
  ["/pos", "pos"],
  ["/stock/transfers", "stockTransfers"],
  ["/stock/adjustments", "stockAdjustment"],
  ["/expenses", "expenses"],
  ["/accounts", "account"],
];

export function moduleForPath(pathname: string): ModuleKey | null {
  const path = pathname.split("?")[0];
  const hit = PREFIXES.filter(([p]) => path === p || path.startsWith(`${p}/`)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}

/** Nav items and routes use the same check, so a switched-off module disappears everywhere at once. */
export function isPathEnabled(modules: Settings["modules"] | undefined, href: string): boolean {
  const key = moduleForPath(href);
  return !key || !modules || modules[key];
}
