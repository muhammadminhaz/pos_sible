import type { DB } from "@/lib/data/schemas";
import { format, subDays } from "date-fns";
import { createCatalog } from "./catalog";
import { createHistory } from "./history";
import { createDiscounts, createOrg } from "./org";
import { idFactory, mulberry32 } from "./rng";
import { defaultSettings } from "./settings";

export const SEED_VERSION = 4;
const HISTORY_DAYS = 180;

/** Two goals a little above the demo shop's recent pace, so the Goals tab opens with something to look at. */
function demoGoals(txns: DB["transactions"], today: string, createdAt: string): DB["goals"] {
  const since = format(subDays(new Date(`${today}T00:00:00`), 30), "yyyy-MM-dd");
  const recent = txns.filter((t) => t.type === "sell" && t.status === "final" && t.date.slice(0, 10) > since);
  const sales = recent.reduce((s, t) => s + t.totals.total, 0);
  const stamp = { createdAt, createdBy: null, note: "" };
  return [
    { id: "goal_sales", metric: "sales", period: "month", target: Math.max(10_000, Math.ceil((sales * 1.15) / 10_000) * 10_000), ...stamp },
    { id: "goal_orders", metric: "orders", period: "month", target: Math.max(10, Math.ceil((recent.length * 1.1) / 10) * 10), ...stamp },
  ];
}

export function createSeed(opts: { seed?: number; today?: string } = {}): DB {
  const today = opts.today ?? format(new Date(), "yyyy-MM-dd");
  const r = mulberry32(opts.seed ?? 42);
  const id = idFactory();
  const start = format(subDays(new Date(`${today}T00:00:00`), HISTORY_DAYS + 20), "yyyy-MM-dd");
  const createdAt = `${start}T08:00:00`;

  const settings = defaultSettings(start);
  const catalog = createCatalog(r, id, createdAt);
  const org = createOrg(r, createdAt);
  const discounts = createDiscounts(catalog.products, today, createdAt);

  const history = createHistory({
    r, id, today, days: HISTORY_DAYS, settings,
    products: catalog.products, variations: catalog.variations, taxRates: catalog.taxRates,
    contacts: org.contacts, customerGroups: org.customerGroups, users: org.users,
    invoiceSchemes: org.invoiceSchemes, accounts: org.accounts, locations: org.locations,
  });

  return {
    ...catalog,
    ...org,
    discounts,
    transactions: history.transactions,
    stockLots: history.stockLots,
    accountTxns: history.accountTxns,
    cashRegisters: history.cashRegisters,
    notifications: history.notifications,
    importBatches: [],
    bookings: [],
    backups: [],
    goals: demoGoals(history.transactions, today, createdAt),
    settings,
    meta: { version: SEED_VERSION, seededAt: today, counters: history.counters },
  };
}
