import type { PaymentMethod } from "@/lib/data/schemas";

export const BKASH: PaymentMethod = "custom_pay_1";
export const NAGAD: PaymentMethod = "custom_pay_2";

/** Custom methods use the business's label ("bKash") when set, else the generic message. */
export function methodLabel(m: PaymentMethod, t: (key: string) => string, customLabels: string[]): string {
  const match = /^custom_pay_(\d)$/.exec(m);
  const custom = match ? customLabels[Number(match[1]) - 1]?.trim() : "";
  return custom || t(`payMethods.${m}`);
}

/** Methods offered at the till: the location's list, minus unlabeled custom methods. */
export function tillMethods(locationMethods: PaymentMethod[], customLabels: string[]): PaymentMethod[] {
  return locationMethods.filter((m) => {
    const match = /^custom_pay_(\d)$/.exec(m);
    return !match || !!customLabels[Number(match[1]) - 1]?.trim();
  });
}
