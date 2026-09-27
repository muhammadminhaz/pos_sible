import { applyRounding, percentOf, roundMoney, type RoundingMode } from "./money";

export type DiscountInput = { type: "fixed" | "percentage"; amount: number };

export type LineInput = {
  qty: number;
  /** Exc. tax when taxType is "exclusive", inc. tax when "inclusive". */
  unitPrice: number;
  taxRate: number;
  taxType: "inclusive" | "exclusive";
  discount?: DiscountInput;
};

export type LineTotals = {
  unitExc: number;
  unitInc: number;
  unitTax: number;
  discountPerUnit: number;
  netUnitInc: number;
  subtotal: number;
  tax: number;
};

export type OrderInput = {
  lines: LineInput[];
  discount?: DiscountInput;
  orderTaxRate?: number;
  shipping?: number;
  additionalExpenses?: number[];
  rounding?: RoundingMode;
  pointsRedeemed?: number;
};

export type OrderTotals = {
  itemsCount: number;
  linesTotal: number;
  discount: number;
  orderTax: number;
  shipping: number;
  additional: number;
  redeemed: number;
  roundOff: number;
  total: number;
};

export function discountValue(base: number, d?: DiscountInput): number {
  if (!d || !d.amount) return 0;
  return d.type === "percentage" ? percentOf(base, d.amount) : roundMoney(Math.min(d.amount, base));
}

export function lineTotals(l: LineInput): LineTotals {
  const unitExc = l.taxType === "inclusive" ? roundMoney(l.unitPrice / (1 + l.taxRate / 100)) : l.unitPrice;
  const discountPerUnit = discountValue(unitExc, l.discount);
  const netExc = roundMoney(unitExc - discountPerUnit);
  const unitTax = percentOf(netExc, l.taxRate);
  const netUnitInc = roundMoney(netExc + unitTax);
  return {
    unitExc,
    unitInc: roundMoney(unitExc + percentOf(unitExc, l.taxRate)),
    unitTax,
    discountPerUnit,
    netUnitInc,
    subtotal: roundMoney(netUnitInc * l.qty),
    tax: roundMoney(unitTax * l.qty),
  };
}

export function orderTotals(o: OrderInput): OrderTotals {
  const linesTotal = roundMoney(o.lines.reduce((s, l) => s + lineTotals(l).subtotal, 0));
  const itemsCount = roundMoney(o.lines.reduce((s, l) => s + l.qty, 0), 4);
  const discount = discountValue(linesTotal, o.discount);
  const orderTax = percentOf(linesTotal - discount, o.orderTaxRate ?? 0);
  const shipping = roundMoney(o.shipping ?? 0);
  const additional = roundMoney((o.additionalExpenses ?? []).reduce((s, n) => s + (n || 0), 0));
  const redeemed = roundMoney(o.pointsRedeemed ?? 0);
  const raw = linesTotal - discount + orderTax + shipping + additional - redeemed;
  const { total, roundOff } = applyRounding(Math.max(0, raw), o.rounding ?? "none");
  return { itemsCount, linesTotal, discount, orderTax, shipping, additional, redeemed, roundOff, total };
}
