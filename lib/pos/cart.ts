import { roundMoney } from "@/lib/domain/money";
import type { DiscountInput } from "@/lib/domain/totals";

export type ShippingZone = "inside_dhaka" | "outside_dhaka" | "free";

export type CartLine = {
  key: string;
  productId: string;
  variationId: string;
  name: string;
  sku: string;
  unitId: string;
  unitName: string;
  allowDecimal: boolean;
  qty: number;
  /** Follows the product's taxType: inc. tax when "inclusive", exc. when "exclusive". */
  unitPrice: number;
  taxId: string | null;
  taxRate: number;
  taxType: "inclusive" | "exclusive";
  discount: DiscountInput | null;
  note: string;
  serials: string[];
  serviceStaffId: string | null;
  enableSerial: boolean;
  /** Stock available at the location when added; null when stock isn't managed. */
  maxQty: number | null;
};

export type CartShipping = { zone: ShippingZone | null; charges: number; details: string; address: string };

export type Cart = {
  lines: CartLine[];
  contactId: string;
  discount: DiscountInput | null;
  orderTaxId: string | null;
  orderTaxRate: number;
  shipping: CartShipping;
  technicianId: string | null;
  invoiceLayoutId: string | null;
  /** null = now at checkout. */
  date: string | null;
  pointsRedeemed: number;
  /** Suspended/draft/quotation this cart was loaded from; checkout replaces it. */
  resumedFromId: string | null;
  note: string;
};

export type AddItemInput = Omit<CartLine, "key" | "qty" | "note" | "serials" | "serviceStaffId"> & { qty?: number };

export const WALK_IN_ID = "walk-in";

export function emptyCart(): Cart {
  return {
    lines: [],
    contactId: WALK_IN_ID,
    discount: null,
    orderTaxId: null,
    orderTaxRate: 0,
    shipping: { zone: null, charges: 0, details: "", address: "" },
    technicianId: null,
    invoiceLayoutId: null,
    date: null,
    pointsRedeemed: 0,
    resumedFromId: null,
    note: "",
  };
}

const newKey = () => Math.random().toString(36).slice(2, 10);

const normQty = (line: Pick<CartLine, "allowDecimal">, qty: number) => {
  const q = line.allowDecimal ? roundMoney(qty, 4) : Math.round(qty);
  return Math.max(line.allowDecimal ? 0.0001 : 1, q);
};

const mapLine = (c: Cart, key: string, fn: (l: CartLine) => CartLine): Cart => ({
  ...c,
  lines: c.lines.map((l) => (l.key === key ? fn(l) : l)),
});

export function addItem(c: Cart, item: AddItemInput, mode: "increase_qty" | "new_row" = "increase_qty"): Cart {
  const qty = item.qty ?? 1;
  const existing = mode === "increase_qty" ? c.lines.find((l) => l.variationId === item.variationId) : undefined;
  if (existing) return mapLine(c, existing.key, (l) => ({ ...l, qty: normQty(l, l.qty + qty) }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { qty: _ignored, ...rest } = item;
  const line: CartLine = { ...rest, key: newKey(), qty: normQty(item, qty), note: "", serials: [], serviceStaffId: null };
  return { ...c, lines: [...c.lines, line] };
}

export const setQty = (c: Cart, key: string, qty: number) => mapLine(c, key, (l) => ({ ...l, qty: normQty(l, qty) }));
export const setPrice = (c: Cart, key: string, unitPrice: number) =>
  mapLine(c, key, (l) => ({ ...l, unitPrice: Math.max(0, roundMoney(unitPrice)) }));
export const setLineDiscount = (c: Cart, key: string, discount: DiscountInput | null) =>
  mapLine(c, key, (l) => ({ ...l, discount: discount && discount.amount > 0 ? discount : null }));
export const setLineNote = (c: Cart, key: string, note: string) => mapLine(c, key, (l) => ({ ...l, note }));
export const setSerials = (c: Cart, key: string, serials: string[]) =>
  mapLine(c, key, (l) => ({ ...l, serials: serials.map((s) => s.trim()).filter(Boolean) }));
export const setServiceStaff = (c: Cart, key: string, serviceStaffId: string | null) =>
  mapLine(c, key, (l) => ({ ...l, serviceStaffId }));
export const removeLine = (c: Cart, key: string): Cart => ({ ...c, lines: c.lines.filter((l) => l.key !== key) });
export const patchCart = (c: Cart, patch: Partial<Omit<Cart, "lines">>): Cart => ({ ...c, ...patch });
export const setContact = (c: Cart, contactId: string): Cart => ({ ...c, contactId, pointsRedeemed: 0 });

export function exceedsStock(line: CartLine, qty: number = line.qty): boolean {
  return line.maxQty != null && qty > line.maxQty;
}
