import type { DB, Transaction } from "@/lib/data/schemas";
import { roundMoney } from "@/lib/domain/money";

/** Qty of an order line already covered by final sells. */
export function fulfilledQty(d: DB, orderLineId: string): number {
  let q = 0;
  for (const t of d.transactions) {
    if (t.type !== "sell" || t.status !== "final") continue;
    for (const l of t.lines) if (l.parentLineId === orderLineId) q += l.qty;
  }
  return roundMoney(q, 4);
}

export function remainingQty(d: DB, order: Transaction): number {
  if (order.status === "completed") return 0;
  return roundMoney(order.lines.reduce((s, l) => s + Math.max(0, l.qty - fulfilledQty(d, l.id)), 0), 4);
}

/** Point each sell line at the first linked order line of the same variation that still has room. */
export function linkLines<L extends { variationId: string; qty: number; parentLineId?: string | null }>(d: DB, orderIds: string[], lines: L[]): L[] {
  const room = new Map<string, number>();
  const candidates = orderIds.flatMap((id) => d.transactions.find((t) => t.id === id && t.type === "sales_order")?.lines ?? []);
  for (const c of candidates) room.set(c.id, c.qty - fulfilledQty(d, c.id));
  return lines.map((l) => {
    const hit = candidates.find((c) => c.variationId === l.variationId && (room.get(c.id) ?? 0) > 0);
    if (!hit) return l;
    room.set(hit.id, (room.get(hit.id) ?? 0) - l.qty);
    return { ...l, parentLineId: hit.id };
  });
}

/** Recompute Ordered / Partial / Completed from linked sells. */
export function syncOrders(d: DB, orderIds: string[]) {
  for (const id of orderIds) {
    const o = d.transactions.find((t) => t.id === id && t.type === "sales_order");
    if (!o) continue;
    const done = o.lines.map((l) => fulfilledQty(d, l.id));
    const all = o.lines.every((l, i) => done[i] >= l.qty);
    o.status = all ? "completed" : done.some((q) => q > 0) ? "partial" : "ordered";
  }
}
