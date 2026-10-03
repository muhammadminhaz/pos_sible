import type { DB } from "@/lib/data/schemas";
import { format, subDays } from "date-fns";
import { createCatalog } from "./catalog";
import { createHistory } from "./history";
import { createDiscounts, createOrg } from "./org";
import { idFactory, mulberry32 } from "./rng";
import { defaultSettings } from "./settings";

export const SEED_VERSION = 4;
const HISTORY_DAYS = 180;

export function createSeed(opts: { seed?: number; today?: string; days?: number } = {}): DB {
  const today = opts.today ?? format(new Date(), "yyyy-MM-dd");
  const days = opts.days ?? HISTORY_DAYS;
  const r = mulberry32(opts.seed ?? 42);
  const id = idFactory();
  const start = format(subDays(new Date(`${today}T00:00:00`), days + 20), "yyyy-MM-dd");
  const createdAt = `${start}T08:00:00`;

  const settings = defaultSettings(start);
  const catalog = createCatalog(r, id, createdAt);
  const org = createOrg(r, createdAt);
  const discounts = createDiscounts(catalog.products, today, createdAt);

  const history = createHistory({
    r, id, today, days, settings,
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
    settings,
    meta: { version: SEED_VERSION, seededAt: today, counters: history.counters },
  };
}
