import type { Tables } from "@/lib/data/schemas";

/** Every collection of the business database, in the order they are created. Adding a key to `Tables` fails the build here until it is listed. */
export const TABLE_NAMES = [
  "locations", "roles", "users", "contacts", "customerGroups", "technicians", "units", "categories", "brands", "warranties",
  "priceGroups", "variationTemplates", "taxRates", "products", "variations", "stockLots", "discounts", "transactions",
  "accountTypes", "accounts", "accountTxns", "expenseCategories", "cashRegisters", "invoiceSchemes", "invoiceLayouts",
  "barcodeSettings", "printers", "importBatches", "notifications", "bookings", "backups",
] as const satisfies readonly (keyof Tables)[];

type Missing = Exclude<keyof Tables, (typeof TABLE_NAMES)[number]>;
// If this line errors, a collection was added to `Tables` without a Postgres table.
export const _allTablesListed: [Missing] extends [never] ? true : never = true;

export type TableName = (typeof TABLE_NAMES)[number];

/** Postgres table name: camelCase → snake_case. */
export const sqlName = (t: string) => t.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
