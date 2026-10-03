/** A subscription package. `maxUsers` counts accounts that can sign in; null means no limit. */
export type Plan = { id: string; label: string; maxUsers: number | null; priceMonthly: number; description: string; benefits: string[] };

/** "cancelled" is the owner switching a business off; an end date in the past ("expired") is derived, not stored. */
export type SubscriptionStatus = "active" | "cancelled";

/**
 * Sellable modules. A business pays for its package (which sets the user limit) plus each module it switches on.
 * Anything not listed here (dashboard, products, contacts, settings, profile) is core and always available.
 */
export const MODULE_IDS = ["pos", "sales", "purchases", "stock", "expenses", "accounts", "reports"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type ModuleDef = { id: ModuleId; label: string; priceMonthly: number };

/** Services a module unlocks (any one of them is enough: the sale form needs the accounts list, for example). */
export const SERVICE_MODULES: Record<string, ModuleId[]> = {
  posService: ["pos"],
  registersService: ["pos"],
  salesService: ["sales", "pos"],
  ordersService: ["sales"],
  returnsService: ["sales"],
  salesImportService: ["sales"],
  discountsService: ["sales", "pos"],
  purchasesService: ["purchases"],
  purchaseReturnsService: ["purchases"],
  purchaseImportService: ["purchases"],
  transfersService: ["stock"],
  adjustmentsService: ["stock"],
  expensesService: ["expenses"],
  accountsService: ["accounts", "sales", "pos", "purchases", "expenses"],
  ledgerReportsService: ["accounts"],
  moneyReports: ["reports"],
  analyticsReports: ["reports"],
  possibleReports: ["reports"],
  goalsService: ["reports"],
  stockReports: ["reports"],
  productReports: ["reports"],
  contactReports: ["reports"],
  activityReports: ["reports"],
};

export const isModuleId = (s: string): s is ModuleId => (MODULE_IDS as readonly string[]).includes(s);

/** Decides whether a business may use the app right now. A free business never lapses, but can still be cancelled. */
export function subscriptionState(status: SubscriptionStatus, expiresAt: Date | string | null, now = new Date(), free = false): "active" | "cancelled" | "expired" {
  if (status === "cancelled") return "cancelled";
  if (!free && expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Modules a business actually gets: everything when free, the chosen list otherwise (null in the database means all). */
export function effectiveModules(chosen: string[] | null, free: boolean): ModuleId[] {
  if (free || chosen === null) return [...MODULE_IDS];
  return MODULE_IDS.filter((m) => chosen.includes(m));
}
