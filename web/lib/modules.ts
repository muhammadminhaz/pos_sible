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

/** Which subscription module a route belongs to; unlisted routes are core and always available. Mirrors the API's SERVICE_MODULES. */
const LICENSED: [string, string][] = [
  ["/pos", "pos"], ["/sales", "sales"], ["/purchases", "purchases"], ["/stock", "stock"],
  ["/expenses", "expenses"], ["/accounts", "accounts"], ["/reports", "reports"],
  ["/opportunities", "reports"], ["/goals", "reports"],
];

/** `licensed` is the list the business subscribes to; null means unknown or the local demo, so everything is on. */
export function isPathLicensed(licensed: readonly string[] | null | undefined, href: string): boolean {
  if (!licensed) return true;
  const path = href.split("?")[0];
  const hit = LICENSED.find(([p]) => path === p || path.startsWith(`${p}/`));
  return !hit || licensed.includes(hit[1]);
}

/** Nav items and routes use the same check, so a switched-off feature disappears everywhere at once. */
export function isPathEnabled(settings: Pick<Settings, "modules" | "sale"> | undefined, href: string, licensed?: readonly string[] | null): boolean {
  if (!isPathLicensed(licensed, href)) return false;
  if (!settings) return true;
  const path = href.split("?")[0];
  if ((path === "/sales/orders" || path.startsWith("/sales/orders/")) && !settings.sale.enableSalesOrder) return false;
  const key = moduleForPath(href);
  return !key || settings.modules[key];
}
