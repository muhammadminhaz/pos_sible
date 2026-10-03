import { z } from "zod";

export const id = z.string().min(1);
export const isoDate = z.string(); // ISO 8601 date or date-time
export const money = z.number();
export const qty = z.number();

export const base = z.object({
  id,
  createdAt: isoDate,
  createdBy: z.string().nullable(),
  /** Stamped by `commit()` on every change, so older rows simply don't have them yet. */
  updatedAt: isoDate.nullish(),
  updatedBy: z.string().nullish(),
});

export const payTerm = z.object({ number: z.number().int().nonnegative(), type: z.enum(["days", "months"]) });
export type PayTerm = z.infer<typeof payTerm>;

export const discountInput = z.object({ type: z.enum(["fixed", "percentage"]), amount: z.number().nonnegative() });

export const address = z.object({
  line1: z.string().default(""),
  line2: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  country: z.string().default("Bangladesh"),
  zip: z.string().default(""),
});
export type Address = z.infer<typeof address>;

export const customFields = z.array(z.string()).default([]);

export const PAYMENT_METHODS = [
  "cash", "card", "cheque", "bank_transfer", "advance", "other",
  "custom_pay_1", "custom_pay_2", "custom_pay_3", "custom_pay_4", "custom_pay_5", "custom_pay_6", "custom_pay_7",
] as const;
export const paymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethod>;

export const SHIPPING_STATUSES = ["ordered", "packed", "shipped", "delivered", "cancelled"] as const;
export const shippingStatus = z.enum(SHIPPING_STATUSES);
export type ShippingStatus = z.infer<typeof shippingStatus>;

export const PAYMENT_STATUSES = ["paid", "partial", "due", "overdue"] as const;
export const paymentStatus = z.enum(PAYMENT_STATUSES);
