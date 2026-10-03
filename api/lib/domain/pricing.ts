import { roundMoney } from "./money";

export function sellPriceFromMargin(purchaseExc: number, marginPct: number): number {
  return roundMoney(purchaseExc * (1 + marginPct / 100));
}

export function marginFromPrices(purchaseExc: number, sellExc: number): number {
  if (!purchaseExc) return 0;
  return roundMoney(((sellExc - purchaseExc) / purchaseExc) * 100);
}

export type CustomerGroupPricing = {
  calcType: "percentage" | "selling_price_group";
  amount: number;
  priceGroupId?: string | null;
};

export function resolveUnitPrice(args: {
  defaultPrice: number;
  groupPrices?: Record<string, number>;
  priceGroupId?: string | null;
  customerGroup?: CustomerGroupPricing | null;
}): number {
  const { defaultPrice, groupPrices = {}, priceGroupId, customerGroup } = args;
  if (customerGroup?.calcType === "selling_price_group" && customerGroup.priceGroupId) {
    const p = groupPrices[customerGroup.priceGroupId];
    if (p != null) return p;
  }
  const base = priceGroupId && groupPrices[priceGroupId] != null ? groupPrices[priceGroupId] : defaultPrice;
  if (customerGroup?.calcType === "percentage" && customerGroup.amount) {
    return roundMoney(base * (1 + customerGroup.amount / 100));
  }
  return base;
}

export type PriceField = "purchasePriceExc" | "purchasePriceInc" | "margin" | "sellPriceExc" | "sellPriceInc";
export type PriceSet = Record<PriceField, number>;

const withTax = (exc: number, rate: number) => roundMoney(exc * (1 + rate / 100));
const withoutTax = (inc: number, rate: number) => roundMoney(inc / (1 + rate / 100));

/**
 * Keeps the five price fields consistent after the user edits one of them.
 * Editing a purchase price keeps the margin and moves the selling price; editing a selling price moves the margin.
 */
export function recalcPrices(p: PriceSet, changed: PriceField, taxRate: number): PriceSet {
  const next = { ...p };
  switch (changed) {
    case "purchasePriceExc":
    case "purchasePriceInc":
      if (changed === "purchasePriceInc") next.purchasePriceExc = withoutTax(next.purchasePriceInc, taxRate);
      else next.purchasePriceInc = withTax(next.purchasePriceExc, taxRate);
      next.sellPriceExc = sellPriceFromMargin(next.purchasePriceExc, next.margin);
      next.sellPriceInc = withTax(next.sellPriceExc, taxRate);
      break;
    case "margin":
      next.sellPriceExc = sellPriceFromMargin(next.purchasePriceExc, next.margin);
      next.sellPriceInc = withTax(next.sellPriceExc, taxRate);
      break;
    case "sellPriceExc":
    case "sellPriceInc":
      if (changed === "sellPriceInc") next.sellPriceExc = withoutTax(next.sellPriceInc, taxRate);
      else next.sellPriceInc = withTax(next.sellPriceExc, taxRate);
      next.margin = marginFromPrices(next.purchasePriceExc, next.sellPriceExc);
      break;
  }
  return next;
}
