import { differenceInCalendarDays, parseISO } from "date-fns";
import { roundMoney } from "./money";

export type Lot = {
  id: string;
  locationId: string;
  variationId: string;
  qtyRemaining: number;
  unitCost: number;
  receivedAt: string;
  expDate?: string | null;
};

export type Allocation = { lotId: string; qty: number; unitCost: number };

export type AllocationResult = { allocations: Allocation[]; shortfall: number; cost: number };

const qtyRound = (n: number) => roundMoney(n, 4);

export function allocate(
  lots: Lot[],
  args: { variationId: string; locationId: string; qty: number; method: "fifo" | "lifo"; allowOverselling?: boolean },
): AllocationResult {
  const pool = lots
    .filter((l) => l.variationId === args.variationId && l.locationId === args.locationId && l.qtyRemaining > 0)
    .sort((a, b) => (args.method === "fifo" ? 1 : -1) * a.receivedAt.localeCompare(b.receivedAt));

  const allocations: Allocation[] = [];
  let remaining = args.qty;
  for (const lot of pool) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qtyRemaining, remaining);
    allocations.push({ lotId: lot.id, qty: qtyRound(take), unitCost: lot.unitCost });
    remaining = qtyRound(remaining - take);
  }

  let shortfall = remaining > 0 ? remaining : 0;
  if (shortfall > 0 && args.allowOverselling) {
    const lastCost = allocations.at(-1)?.unitCost ?? pool.at(-1)?.unitCost ?? 0;
    allocations.push({ lotId: "oversell", qty: shortfall, unitCost: lastCost });
    shortfall = 0;
  }

  const cost = roundMoney(allocations.reduce((s, a) => s + a.qty * a.unitCost, 0));
  return { allocations, shortfall, cost };
}

export function available(lots: Lot[], variationId: string, locationId?: string): number {
  return qtyRound(
    lots
      .filter((l) => l.variationId === variationId && (!locationId || l.locationId === locationId))
      .reduce((s, l) => s + l.qtyRemaining, 0),
  );
}

export type ExpiryState = "expired" | "expiring" | "ok" | "none";

export function expiryState(expDate: string | null | undefined, today: string, alertDays: number): ExpiryState {
  if (!expDate) return "none";
  const days = differenceInCalendarDays(parseISO(expDate), parseISO(today));
  if (days < 0) return "expired";
  if (days <= alertDays) return "expiring";
  return "ok";
}
