import { z } from "zod";
import { address, base, customFields, isoDate, paymentMethod } from "./common";

export const location = base.extend({
  code: z.string(), // BL0001
  name: z.string().min(1),
  landmark: z.string().default(""),
  address,
  mobile: z.string().default(""),
  email: z.string().default(""),
  website: z.string().default(""),
  priceGroupId: z.string().nullable(),
  invoiceSchemeId: z.string(),
  posLayoutId: z.string(),
  saleLayoutId: z.string(),
  paymentMethods: z.array(paymentMethod),
  defaultAccounts: z.record(z.string(), z.string().nullable()).default({}),
  featuredProductIds: z.array(z.string()).default([]),
  customFields,
  active: z.boolean(),
});
export type Location = z.infer<typeof location>;

export const role = base.extend({
  name: z.string().min(1),
  permissions: z.array(z.string()),
  isServiceStaff: z.boolean().default(false),
  locationIds: z.array(z.string()).default([]), // empty = all
  /** Which permission list this role was written against; see `upgradeRoles`. Missing means the first one. */
  permVersion: z.number().optional(),
});
export type Role = z.infer<typeof role>;

export const user = base.extend({
  username: z.string().min(1),
  password: z.string(), // mock only
  prefix: z.string().default(""),
  firstName: z.string().min(1),
  lastName: z.string().default(""),
  email: z.string().default(""),
  roleId: z.string(),
  locationIds: z.array(z.string()).default([]), // empty = all
  language: z.enum(["en", "bn"]).default("en"),
  isActive: z.boolean().default(true),
  allowLogin: z.boolean().default(true),
  isSalesAgent: z.boolean().default(false),
  commissionPercent: z.number().default(0),
  maxSalesDiscountPercent: z.number().nullable().default(null),
  avatar: z.string().nullable().default(null),
  profile: z
    .object({
      dob: isoDate.nullable(),
      gender: z.enum(["male", "female", "others"]).nullable(),
      maritalStatus: z.enum(["married", "unmarried", "divorced"]).nullable(),
      bloodGroup: z.string(),
      mobile: z.string(),
      altNumber: z.string(),
      familyNumber: z.string(),
      fbLink: z.string(),
      twitterLink: z.string(),
      socialMedia1: z.string(),
      socialMedia2: z.string(),
      customFields,
      guardianName: z.string(),
      idProofName: z.string(),
      idProofNumber: z.string(),
      permanentAddress: z.string(),
      currentAddress: z.string(),
    })
    .partial()
    .default({}),
  bankDetails: z
    .object({
      accountHolderName: z.string(),
      accountNumber: z.string(),
      bankName: z.string(),
      bankCode: z.string(),
      branch: z.string(),
      taxPayerId: z.string(),
    })
    .partial()
    .default({}),
});
export type User = z.infer<typeof user>;
