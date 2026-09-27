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
