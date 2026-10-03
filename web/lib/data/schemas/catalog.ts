import { z } from "zod";
import { base, customFields, isoDate } from "./common";

export const BARCODE_TYPES = ["C128", "C39", "EAN13", "EAN8", "UPCA", "UPCE"] as const;

export const unit = base.extend({
  name: z.string().min(1),
  shortName: z.string().min(1),
  allowDecimal: z.boolean(),
  baseUnitId: z.string().nullable().default(null),
  multiplier: z.number().nullable().default(null),
});
export type Unit = z.infer<typeof unit>;

export const category = base.extend({
  name: z.string().min(1),
  code: z.string().default(""),
  description: z.string().default(""),
  parentId: z.string().nullable().default(null),
});
export type Category = z.infer<typeof category>;

export const brand = base.extend({ name: z.string().min(1), note: z.string().default("") });
export type Brand = z.infer<typeof brand>;

export const warranty = base.extend({
  name: z.string().min(1),
  description: z.string().default(""),
  duration: z.number().int().positive(),
  durationType: z.enum(["days", "months", "years"]),
});
export type Warranty = z.infer<typeof warranty>;

export const priceGroup = base.extend({
  name: z.string().min(1),
  description: z.string().default(""),
  active: z.boolean().default(true),
});
export type PriceGroup = z.infer<typeof priceGroup>;

export const variationTemplate = base.extend({
  name: z.string().min(1),
  values: z.array(z.string()),
});
export type VariationTemplate = z.infer<typeof variationTemplate>;

export const taxRate = base.extend({
  name: z.string().min(1),
  rate: z.number(),
  isGroup: z.boolean().default(false),
  subTaxIds: z.array(z.string()).default([]),
});
export type TaxRate = z.infer<typeof taxRate>;

export const product = base.extend({
  name: z.string().min(1),
  sku: z.string(),
  barcodeType: z.enum(BARCODE_TYPES),
  unitId: z.string(),
  subUnitIds: z.array(z.string()).default([]),
  secondaryUnitId: z.string().nullable().default(null),
  brandId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  subCategoryId: z.string().nullable().default(null),
  locationIds: z.array(z.string()),
  manageStock: z.boolean(),
  alertQty: z.number().nullable().default(null),
  description: z.string().default(""),
  image: z.string().nullable().default(null),
  brochure: z.string().nullable().default(null),
  expiryPeriod: z.number().nullable().default(null),
  expiryPeriodType: z.enum(["days", "months"]).nullable().default(null),
  enableSerial: z.boolean().default(false),
  notForSale: z.boolean().default(false),
  weight: z.string().default(""),
  prepTimeMinutes: z.number().nullable().default(null),
  taxId: z.string().nullable().default(null),
  taxType: z.enum(["inclusive", "exclusive"]),
  type: z.enum(["single", "variable", "combo"]),
  variationTemplateId: z.string().nullable().default(null),
  warrantyId: z.string().nullable().default(null),
  rack: z.string().default(""),
  row: z.string().default(""),
  position: z.string().default(""),
  customFields,
  active: z.boolean().default(true),
});
export type Product = z.infer<typeof product>;

export const variation = base.extend({
  productId: z.string(),
  name: z.string(), // "DUMMY" for single products
  sku: z.string(),
  purchasePriceExc: z.number(),
  purchasePriceInc: z.number(),
  margin: z.number(),
  sellPriceExc: z.number(),
  sellPriceInc: z.number(),
  groupPrices: z.record(z.string(), z.number()).default({}),
  image: z.string().nullable().default(null),
  comboItems: z.array(z.object({ variationId: z.string(), qty: z.number(), unitId: z.string() })).default([]),
});
export type Variation = z.infer<typeof variation>;

export const stockLot = base.extend({
  locationId: z.string(),
  variationId: z.string(),
  productId: z.string(),
  sourceTxnId: z.string().nullable(), // null = opening stock
  lotNo: z.string().default(""),
  qtyIn: z.number(),
  qtyRemaining: z.number(),
  unitCost: z.number(),
  receivedAt: isoDate,
  mfgDate: isoDate.nullable().default(null),
  expDate: isoDate.nullable().default(null),
});
export type StockLot = z.infer<typeof stockLot>;

export const discount = base.extend({
  name: z.string().min(1),
  locationId: z.string().nullable(),
  productIds: z.array(z.string()).default([]),
  brandId: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  priority: z.number().int().default(1),
  type: z.enum(["fixed", "percentage"]),
  amount: z.number(),
  startsAt: isoDate,
  endsAt: isoDate,
  priceGroupIds: z.array(z.string()).default([]),
  applyInCustomerGroups: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type Discount = z.infer<typeof discount>;

export const productCustomFieldsCount = 4;
export type ProductCustomFields = z.infer<typeof customFields>;
