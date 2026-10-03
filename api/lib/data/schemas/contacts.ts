import { z } from "zod";
import { address, base, customFields, isoDate, payTerm } from "./common";

export const contact = base.extend({
  code: z.string(), // CO0001
  type: z.enum(["supplier", "customer", "both"]),
  kind: z.enum(["individual", "business"]).default("individual"),
  businessName: z.string().default(""),
  prefix: z.string().default(""),
  name: z.string().min(1),
  mobile: z.string().min(1),
  altNumber: z.string().default(""),
  landline: z.string().default(""),
  email: z.string().default(""),
  dob: isoDate.nullable().default(null),
  taxNumber: z.string().default(""),
  customerGroupId: z.string().nullable().default(null),
  payTerm: payTerm.nullable().default(null),
  creditLimit: z.number().nullable().default(null),
  openingBalance: z.number().default(0),
  advanceBalance: z.number().default(0),
  points: z.number().default(0),
  assignedTo: z.array(z.string()).default([]),
  crmSource: z.string().nullable().default(null),
  crmLifeStage: z.string().nullable().default(null),
  address,
  shippingAddress: z.string().default(""),
  customFields,
  isDefault: z.boolean().default(false), // Walk-In Customer
  active: z.boolean().default(true),
});
export type Contact = z.infer<typeof contact>;

export const customerGroup = base.extend({
  name: z.string().min(1),
  calcType: z.enum(["percentage", "selling_price_group"]),
  amount: z.number().default(0),
  priceGroupId: z.string().nullable().default(null),
});
export type CustomerGroup = z.infer<typeof customerGroup>;

export const technician = base.extend({ name: z.string().min(1) });
export type Technician = z.infer<typeof technician>;
