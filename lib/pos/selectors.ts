import type { PaymentMethod } from "@/lib/data/schemas";
import { roundMoney, type RoundingMode } from "@/lib/domain/money";
import { redeemValue, type RewardSettings } from "@/lib/domain/rewards";
import { lineTotals, orderTotals, type LineTotals, type OrderTotals } from "@/lib/domain/totals";
import type { Cart } from "./cart";

export type CartTotals = OrderTotals & { lines: LineTotals[] };
export type TotalsContext = { rounding: RoundingMode; rewards: RewardSettings };

export function cartTotals(c: Cart, ctx: TotalsContext): CartTotals {
  const inputs = c.lines.map((l) => ({
    qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate, taxType: l.taxType, discount: l.discount ?? undefined,
  }));
  const totals = orderTotals({
    lines: inputs,
    discount: c.discount ?? undefined,
    orderTaxRate: c.orderTaxRate,
    shipping: c.shipping.charges,
    rounding: ctx.rounding,
    pointsRedeemed: redeemValue(c.pointsRedeemed, ctx.rewards),
  });
  return { ...totals, lines: inputs.map(lineTotals) };
}

export type PayRow = { method: PaymentMethod; amount: number };
export type PaymentState = { paid: number; change: number; shortfall: number; nonCashOverpaid: boolean };

/** Change is only ever given in cash, and only up to the cash tendered. */
export function paymentState(payable: number, rows: PayRow[]): PaymentState {
  const paid = roundMoney(rows.reduce((s, r) => s + (r.amount || 0), 0));
  const cash = roundMoney(rows.filter((r) => r.method === "cash").reduce((s, r) => s + (r.amount || 0), 0));
  const nonCash = roundMoney(paid - cash);
  const over = roundMoney(Math.max(0, paid - payable));
  return {
    paid,
    change: roundMoney(Math.min(over, cash)),
    shortfall: roundMoney(Math.max(0, payable - paid)),
    nonCashOverpaid: nonCash > payable,
  };
}
