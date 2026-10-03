import { z } from "zod";
import { base, isoDate } from "./common";

export const invoiceScheme = base.extend({
  name: z.string().min(1),
  prefix: z.string().default(""),
  numberingType: z.enum(["sequential", "random"]),
  startFrom: z.number().int().default(1),
  count: z.number().int().default(0),
  digits: z.number().int().min(1).max(10).default(4),
  isDefault: z.boolean().default(false),
});
export type InvoiceScheme = z.infer<typeof invoiceScheme>;

export const invoiceLayout = base.extend({
  name: z.string().min(1),
  design: z.enum(["classic", "elegant", "detailed", "columnize", "slim", "a4"]),
  paper: z.enum(["80mm", "58mm", "a4", "a5"]),
  headerText: z.string().default(""),
  footerText: z.string().default(""),
  showLogo: z.boolean().default(true),
  showBusinessName: z.boolean().default(true),
  showLocationName: z.boolean().default(true),
  showMobile: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showEmail: z.boolean().default(false),
  showTax1: z.boolean().default(false),
  showCustomer: z.boolean().default(true),
  showBarcode: z.boolean().default(false),
  showQrCode: z.boolean().default(false),
  showPaymentInfo: z.boolean().default(true),
  showPreviousDue: z.boolean().default(false),
  showBrand: z.boolean().default(false),
  showSku: z.boolean().default(true),
  showWarranty: z.boolean().default(false),
  showSignature: z.boolean().default(false),
  labels: z.record(z.string(), z.string()).default({}),
  isDefault: z.boolean().default(false),
});
export type InvoiceLayout = z.infer<typeof invoiceLayout>;

export const barcodeSetting = base.extend({
  name: z.string().min(1),
  description: z.string().default(""),
  isContinuous: z.boolean().default(false),
  paperWidth: z.number(), // inches
  paperHeight: z.number().nullable(),
  labelWidth: z.number(),
  labelHeight: z.number(),
  topMargin: z.number().default(0),
  leftMargin: z.number().default(0),
  rowDistance: z.number().default(0),
  colDistance: z.number().default(0),
  perRow: z.number().int(),
  perSheet: z.number().int().nullable(),
  isDefault: z.boolean().default(false),
});
export type BarcodeSetting = z.infer<typeof barcodeSetting>;

export const printer = base.extend({
  name: z.string().min(1),
  connectionType: z.enum(["network", "windows", "linux"]),
  capabilityProfile: z.enum(["default", "simple", "SP2000", "TEP-200M", "P822D"]),
  charPerLine: z.number().int().default(42),
  ip: z.string().default(""),
  port: z.string().default("9100"),
  path: z.string().default(""),
});
export type Printer = z.infer<typeof printer>;

export const importBatch = base.extend({
  kind: z.enum(["contacts", "products", "opening_stock", "sales", "prices"]),
  fileName: z.string(),
  rows: z.number(),
  recordIds: z.array(z.string()),
});
export type ImportBatch = z.infer<typeof importBatch>;

export const notification = base.extend({
  title: z.string(),
  body: z.string().default(""),
  href: z.string().nullable().default(null),
  readAt: isoDate.nullable().default(null),
  kind: z.enum(["info", "success", "warning", "danger"]).default("info"),
  // Generated alerts: one live notification per `key`, worded from `type` + `params` in the viewer's language.
  key: z.string().nullable().default(null),
  type: z.string().nullable().default(null),
  params: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  /** Business location the alert is about; users who cannot access it do not see it. `null` = whole business. */
  locationId: z.string().nullable().default(null),
  /** Permission needed to see (and act on) the alert. */
  permission: z.string().nullable().default(null),
  /** How bad it is (usually a count); a higher value than last time makes a read alert unread again. */
  signal: z.number().default(0),
  /** Per-user read times, so one person reading an alert does not clear it for the rest of the team. */
  readBy: z.record(z.string(), isoDate).default({}),
});
export type Notification = z.infer<typeof notification>;

export const booking = base.extend({
  locationId: z.string(),
  contactId: z.string(),
  tableId: z.string().nullable().default(null),
  start: isoDate,
  end: isoDate,
  note: z.string().default(""),
  status: z.enum(["booked", "waiting", "completed", "cancelled"]),
});
export type Booking = z.infer<typeof booking>;

export const backup = base.extend({ name: z.string(), size: z.number(), payload: z.string() });
export type Backup = z.infer<typeof backup>;

/** What a goal can measure. `expenses` is a ceiling: the goal is met by staying under it. */
export const GOAL_METRICS = ["sales", "grossProfit", "netProfit", "orders", "aov", "newCustomers", "activeCustomers", "expenses"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const GOAL_PERIODS = ["month", "quarter", "year"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const goal = base.extend({
  metric: z.enum(GOAL_METRICS),
  target: z.number().positive().max(1e12),
  period: z.enum(GOAL_PERIODS),
  /** The shopkeeper's own words for why it matters ("my second shop"). */
  note: z.string().trim().max(80).default(""),
});
export type Goal = z.infer<typeof goal>;
