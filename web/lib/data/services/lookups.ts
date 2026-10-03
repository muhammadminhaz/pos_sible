import { service } from "@/lib/data/api/facade";
import type { DB } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { canDo } from "@/lib/auth/assertCan";
import { delay } from "./_util";

export type Lookups = Pick<
  DB,
  | "locations" | "units" | "categories" | "brands" | "taxRates" | "users" | "roles" | "customerGroups" | "priceGroups"
  | "accounts" | "accountTypes" | "expenseCategories" | "warranties" | "variationTemplates" | "technicians" | "invoiceSchemes" | "invoiceLayouts"
>;

/**
 * Pickers only need who a person is, not their login, contact details, pay or permissions. Callers without
 * `user.view` / `role.view` get that directory view; the real rows stay behind those permissions.
 */
const directoryUser = (u: DB["users"][number]): DB["users"][number] => ({
  ...u, username: "", password: "", email: "", profile: {}, bankDetails: {}, modules: [], locationIds: [], commissionPercent: 0, maxSalesDiscountPercent: null,
});
const directoryRole = (r: DB["roles"][number]): DB["roles"][number] => ({ ...r, permissions: [], locationIds: [] });

/** Small reference tables every form needs. Cached long by the hook. */
export const lookupsService = service("lookupsService", {
  async all(): Promise<Lookups> {
    await delay();
    const db = getDB();
    return {
      locations: db.locations, units: db.units, categories: db.categories, brands: db.brands, taxRates: db.taxRates,
      users: canDo("user.view") ? db.users : db.users.map(directoryUser), roles: canDo("role.view") ? db.roles : db.roles.map(directoryRole), customerGroups: db.customerGroups, priceGroups: db.priceGroups, accounts: db.accounts, accountTypes: db.accountTypes,
      expenseCategories: db.expenseCategories, warranties: db.warranties, variationTemplates: db.variationTemplates,
      technicians: db.technicians, invoiceSchemes: db.invoiceSchemes, invoiceLayouts: db.invoiceLayouts,
    };
  },
});
