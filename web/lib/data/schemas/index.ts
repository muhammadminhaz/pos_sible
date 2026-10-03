export * from "./common";
export * from "./org";
export * from "./contacts";
export * from "./catalog";
export * from "./transactions";
export * from "./accounts";
export * from "./misc";
export * from "./settings";

import type { Account, AccountTxn, AccountType, CashRegister, ExpenseCategory } from "./accounts";
import type {
  Brand, Category, Discount, PriceGroup, Product, StockLot, TaxRate, Unit, Variation, VariationTemplate, Warranty,
} from "./catalog";
import type { Contact, CustomerGroup, Technician } from "./contacts";
import type {
  Backup, BarcodeSetting, Booking, ImportBatch, InvoiceLayout, InvoiceScheme, Notification, Printer,
} from "./misc";
import type { Location, Role, User } from "./org";
import type { Settings } from "./settings";
import type { Transaction } from "./transactions";

export type Tables = {
  locations: Location[];
  roles: Role[];
  users: User[];
  contacts: Contact[];
  customerGroups: CustomerGroup[];
  technicians: Technician[];
  units: Unit[];
  categories: Category[];
  brands: Brand[];
  warranties: Warranty[];
  priceGroups: PriceGroup[];
  variationTemplates: VariationTemplate[];
  taxRates: TaxRate[];
  products: Product[];
  variations: Variation[];
  stockLots: StockLot[];
  discounts: Discount[];
  transactions: Transaction[];
  accountTypes: AccountType[];
  accounts: Account[];
  accountTxns: AccountTxn[];
  expenseCategories: ExpenseCategory[];
  cashRegisters: CashRegister[];
  invoiceSchemes: InvoiceScheme[];
  invoiceLayouts: InvoiceLayout[];
  barcodeSettings: BarcodeSetting[];
  printers: Printer[];
  importBatches: ImportBatch[];
  notifications: Notification[];
  bookings: Booking[];
  backups: Backup[];
};

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T][number];

export type DBMeta = {
  version: number;
  seededAt: string;
  /** Reference counters keyed by prefix ("PO", "SP", …) — next ref = counter + 1. */
  counters: Record<string, number>;
  /** First-run setup. Absent on data created before onboarding existed. */
  onboarding?: Onboarding;
};

export type Onboarding = {
  done: boolean;
  /** "demo" keeps the sample shop; "fresh" starts with an empty one. */
  mode?: "demo" | "fresh";
  completedAt?: string;
  checklistDismissed?: boolean;
  /** Checklist steps ticked by visiting a screen (e.g. reports). */
  visited?: string[];
};

export type DB = Tables & { settings: Settings; meta: DBMeta };
