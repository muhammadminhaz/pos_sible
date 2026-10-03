/** How long one paid term of a package lasts: `periodCount` days, weeks or months. */
export const PERIOD_UNITS = ["day", "week", "month"] as const;
export type PeriodUnit = (typeof PERIOD_UNITS)[number];

/**
 * A subscription package the platform owner sells. `price` is what one term costs, `maxUsers` counts accounts that can
 * sign in (null means no limit) and `modules` are the sellable modules the package includes.
 */
export type Plan = { id: string; label: string; maxUsers: number | null; price: number; periodUnit: PeriodUnit; periodCount: number; modules: ModuleId[]; description: string; benefits: string[] };

/** "cancelled" is the owner switching a business off; an end date in the past ("expired") is derived, not stored. */
export type SubscriptionStatus = "active" | "cancelled";

/**
 * Sellable modules. A package says which of them a business may use; a business can switch some of those off.
 * Anything not listed here (dashboard, products, contacts, settings, profile) is core and always available.
 */
export const MODULE_IDS = ["pos", "sales", "purchases", "stock", "expenses", "accounts", "reports"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type ModuleDef = { id: ModuleId; label: string };

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

/** Modules a business actually gets: everything when free, otherwise the chosen list (null = all) within what its package includes. */
export function effectiveModules(chosen: string[] | null, free: boolean, included: readonly string[] = MODULE_IDS): ModuleId[] {
  if (free) return [...MODULE_IDS];
  return MODULE_IDS.filter((m) => included.includes(m) && (chosen === null || chosen.includes(m)));
}

/** The `interval` Postgres adds for `terms` terms of a package, e.g. "3 months", "14 days". Only validated numbers and units reach it. */
export const termInterval = (plan: Pick<Plan, "periodUnit" | "periodCount">, terms: number) => `${plan.periodCount * terms} ${plan.periodUnit}s`;

const DAYS_PER_UNIT: Record<PeriodUnit, number> = { day: 1, week: 7, month: 30 };

/** What a package brings in per 30 days, so daily, weekly and monthly packages can be added up. */
export const monthlyEquivalent = (plan: Pick<Plan, "price" | "periodUnit" | "periodCount">) => (plan.price * 30) / (plan.periodCount * DAYS_PER_UNIT[plan.periodUnit]);
