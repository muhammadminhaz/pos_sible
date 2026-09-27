import { z } from "zod";
import { base, isoDate } from "./common";

export const accountType = base.extend({
  name: z.string().min(1),
  parentId: z.string().nullable().default(null),
});
export type AccountType = z.infer<typeof accountType>;

export const account = base.extend({
  name: z.string().min(1),
  typeId: z.string().nullable(),
  number: z.string().default(""),
  note: z.string().default(""),
  details: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  openingBalance: z.number().default(0),
  status: z.enum(["active", "closed"]).default("active"),
});
export type Account = z.infer<typeof account>;

/** Ledger entry. Credit increases balance, debit decreases it. */
export const accountTxn = base.extend({
  accountId: z.string(),
  kind: z.enum(["credit", "debit"]),
  subType: z.enum(["opening_balance", "fund_transfer", "deposit", "payment"]),
  amount: z.number(),
  date: isoDate,
  transactionId: z.string().nullable().default(null),
  paymentId: z.string().nullable().default(null),
  transferPairId: z.string().nullable().default(null),
  note: z.string().default(""),
});
export type AccountTxn = z.infer<typeof accountTxn>;

export const expenseCategory = base.extend({
  name: z.string().min(1),
  code: z.string().default(""),
  parentId: z.string().nullable().default(null),
});
export type ExpenseCategory = z.infer<typeof expenseCategory>;

export const cashRegister = base.extend({
  userId: z.string(),
  locationId: z.string(),
  openedAt: isoDate,
  closedAt: isoDate.nullable(),
  openingCash: z.number(),
  closingAmount: z.number().nullable().default(null),
  totalCardSlips: z.number().default(0),
  totalCheques: z.number().default(0),
  closingNote: z.string().default(""),
  denominations: z.record(z.string(), z.number()).default({}),
  status: z.enum(["open", "close"]),
});
export type CashRegister = z.infer<typeof cashRegister>;
