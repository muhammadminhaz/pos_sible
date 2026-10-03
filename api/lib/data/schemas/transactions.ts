import { z } from "zod";
import { base, discountInput, isoDate, paymentMethod, paymentStatus, payTerm, shippingStatus } from "./common";

export const TXN_TYPES = [
  "purchase",
  "purchase_return",
  "sell",
  "sell_return",
  "sales_order",
  "stock_transfer",
  "stock_adjustment",
  "expense",
] as const;
export const txnType = z.enum(TXN_TYPES);
export type TxnType = z.infer<typeof txnType>;

/**
 * Status by type:
 * - sell: final | draft | quotation | proforma | suspended
 * - purchase: received | pending | ordered
 * - sales_order: ordered | partial | completed
 * - stock_transfer: pending | in_transit | completed
 * - others: final
 */
export const TXN_STATUSES = [
  "final", "draft", "quotation", "proforma", "suspended",
  "received", "pending", "ordered",
  "partial", "completed",
  "in_transit",
] as const;
export const txnStatus = z.enum(TXN_STATUSES);
export type TxnStatus = z.infer<typeof txnStatus>;

export const txnLine = z.object({
  id: z.string(),
  productId: z.string(),
  variationId: z.string(),
  unitId: z.string(),
  qty: z.number(),
  /** Price as entered, exc. tax for purchases; follows product taxType for sales. */
  unitPrice: z.number(),
  taxId: z.string().nullable().default(null),
  taxRate: z.number().default(0),
  taxType: z.enum(["inclusive", "exclusive"]).default("exclusive"),
  discount: discountInput.nullable().default(null),
  subtotal: z.number(),
  /** Unit cost allocated from stock (sales) — used for profit. */
  unitCost: z.number().default(0),
  allocations: z.array(z.object({ lotId: z.string(), qty: z.number(), unitCost: z.number() })).default([]),
  lotNo: z.string().default(""),
  mfgDate: isoDate.nullable().default(null),
  expDate: isoDate.nullable().default(null),
  sellPriceInc: z.number().nullable().default(null), // purchase: updates selling price
  note: z.string().default(""),
  serials: z.array(z.string()).default([]),
  serviceStaffId: z.string().nullable().default(null),
  returnedQty: z.number().default(0),
  parentLineId: z.string().nullable().default(null), // for returns / sales-order fulfilment
});
export type TxnLine = z.infer<typeof txnLine>;

export const payment = z.object({
  id: z.string(),
  refNo: z.string(),
  amount: z.number(),
  method: paymentMethod,
  accountId: z.string().nullable().default(null),
  paidOn: isoDate,
  note: z.string().default(""),
  isReturn: z.boolean().default(false), // change returned to customer
  details: z
    .object({
      cardNumber: z.string(),
      cardHolder: z.string(),
      cardTxnNo: z.string(),
      cardType: z.enum(["credit", "debit", "visa", "master"]),
      cardMonth: z.string(),
      cardYear: z.string(),
      chequeNo: z.string(),
      bankAccountNo: z.string(),
      txnNo: z.string(),
    })
    .partial()
    .default({}),
  createdBy: z.string().nullable(),
});
export type Payment = z.infer<typeof payment>;

export const txnTotals = z.object({
  itemsCount: z.number(),
  linesTotal: z.number(),
  discount: z.number(),
  orderTax: z.number(),
  shipping: z.number(),
  additional: z.number(),
  redeemed: z.number(),
  roundOff: z.number(),
  total: z.number(),
});
export type TxnTotals = z.infer<typeof txnTotals>;

export const transaction = base.extend({
  type: txnType,
  status: txnStatus,
  channel: z.enum(["pos", "web"]).default("web"),
  locationId: z.string(),
  transferLocationId: z.string().nullable().default(null), // stock_transfer destination
  contactId: z.string().nullable().default(null),
  refNo: z.string(), // invoice no for sells
  date: isoDate,
  lines: z.array(txnLine),
  discount: discountInput.nullable().default(null),
  orderTaxId: z.string().nullable().default(null),
  orderTaxRate: z.number().default(0),
  pointsRedeemed: z.number().default(0),
  pointsEarned: z.number().default(0),
  shipping: z
    .object({
      details: z.string().default(""),
      address: z.string().default(""),
      charges: z.number().default(0),
      status: shippingStatus.nullable().default(null),
      deliveredTo: z.string().default(""),
      deliveryPersonId: z.string().nullable().default(null),
      zone: z.enum(["inside_dhaka", "outside_dhaka", "free"]).nullable().default(null),
      documents: z.array(z.string()).default([]),
    })
    .default({}),
  additionalExpenses: z.array(z.object({ name: z.string(), amount: z.number() })).default([]),
  totals: txnTotals,
  payments: z.array(payment).default([]),
  paymentStatus: paymentStatus,
  payTerm: payTerm.nullable().default(null),
  exchangeRate: z.number().default(1),
  notes: z.string().default(""),
  staffNote: z.string().default(""),
  documents: z.array(z.string()).default([]),
  recurring: z
    .object({
      interval: z.number(),
      intervalType: z.enum(["days", "months", "years"]),
      repetitions: z.number().nullable(),
      repeatOn: z.number().nullable(),
      parentId: z.string().nullable(),
    })
    .nullable()
    .default(null),
  parentId: z.string().nullable().default(null), // return → original; sell ← sales_order ids in salesOrderIds
  salesOrderIds: z.array(z.string()).default([]),
  invoiceSchemeId: z.string().nullable().default(null),
  invoiceLayoutId: z.string().nullable().default(null),
  technicianId: z.string().nullable().default(null),
  commissionAgentId: z.string().nullable().default(null),
  tableId: z.string().nullable().default(null),
  typesOfService: z.string().nullable().default(null),
  // stock adjustment
  adjustmentType: z.enum(["normal", "abnormal"]).nullable().default(null),
  amountRecovered: z.number().default(0),
  // expense
  expenseCategoryId: z.string().nullable().default(null),
  expenseSubCategoryId: z.string().nullable().default(null),
  expenseForUserId: z.string().nullable().default(null),
  isRefund: z.boolean().default(false),
  customFields: z.array(z.string()).default([]),
  importBatchId: z.string().nullable().default(null),
});
export type Transaction = z.infer<typeof transaction>;
