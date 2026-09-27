import type { DB } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { delay } from "./_util";

export type Lookups = Pick<
  DB,
  | "locations" | "units" | "categories" | "brands" | "taxRates" | "users" | "roles" | "customerGroups" | "priceGroups"
  | "accounts" | "expenseCategories" | "warranties" | "variationTemplates" | "technicians" | "invoiceSchemes" | "invoiceLayouts"
>;

/** Small reference tables every form needs. Cached long by the hook. */
export const lookupsService = {
  async all(): Promise<Lookups> {
    await delay();
    const db = getDB();
    return {
      locations: db.locations, units: db.units, categories: db.categories, brands: db.brands, taxRates: db.taxRates,
      users: db.users, roles: db.roles, customerGroups: db.customerGroups, priceGroups: db.priceGroups, accounts: db.accounts,
      expenseCategories: db.expenseCategories, warranties: db.warranties, variationTemplates: db.variationTemplates,
      technicians: db.technicians, invoiceSchemes: db.invoiceSchemes, invoiceLayouts: db.invoiceLayouts,
    };
  },
};
