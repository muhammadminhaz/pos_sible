import { InsufficientStockError } from "@/lib/data/errors";
import type { DB } from "@/lib/data/schemas";
import { roundMoney } from "@/lib/domain/money";
import { allocate, available, type Allocation } from "@/lib/domain/stock";

/**
 * Takes `qty` of a variation out of a location's lots (FIFO or LIFO per settings) and returns what was taken.
 * Overselling is allowed only when `oversell` says so; the shortfall is then recorded against the pseudo lot "oversell".
 */
export function takeStock(d: DB, a: { variationId: string; locationId: string; qty: number; name: string; oversell?: boolean }): { allocations: Allocation[]; unitCost: number } {
  const res = allocate(d.stockLots, { variationId: a.variationId, locationId: a.locationId, qty: a.qty, method: d.settings.business.accountingMethod, allowOverselling: a.oversell });
  if (res.shortfall > 0) throw new InsufficientStockError(a.name, available(d.stockLots, a.variationId, a.locationId));
  for (const al of res.allocations) {
    const lot = d.stockLots.find((l) => l.id === al.lotId);
    if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining - al.qty, 4);
  }
  return { allocations: res.allocations, unitCost: a.qty ? roundMoney(res.cost / a.qty) : 0 };
}

/** Puts previously taken stock back into the lots it came from. */
export function putBack(d: DB, allocations: Allocation[]): void {
  for (const al of allocations) {
    const lot = d.stockLots.find((l) => l.id === al.lotId);
    if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining + al.qty, 4);
  }
}

/**
 * With "stop selling" on, stock expiring before today + N days can't be sold. Returns that cutoff date, or
 * undefined when expired stock may still be sold.
 */
export function expiryCutoff(d: DB, today: string): string | undefined {
  const p = d.settings.product;
  if (!p.enableExpiry || p.onExpiry !== "stop_selling") return undefined;
  const t = new Date(`${today.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + Math.max(0, p.stopSellingBeforeDays));
  return t.toISOString().slice(0, 10);
}
