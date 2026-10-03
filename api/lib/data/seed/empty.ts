import type { DB } from "@/lib/data/schemas";
import { createSeed } from "./index";
import { SCHEME } from "./org";
import { LOC_RANGO, SEED_USER, WALK_IN } from "./mk";

/**
 * A shop with nothing sold yet: the configuration a new business needs (one location, tax rates, units, payment
 * accounts, roles, an admin and a cashier, invoice numbering) without the demo catalogue, customers or history.
 */
export function createEmptySeed(opts: { today?: string } = {}): DB {
  const demo = createSeed({ today: opts.today });
  const keepUsers = new Set([SEED_USER, "user_cashier"]);
  const location = demo.locations.find((l) => l.id === LOC_RANGO)!;
  const scheme = demo.invoiceSchemes.find((s) => s.id === SCHEME.default)!;

  return {
    ...demo,
    // Catalogue, stock and history belong to the demo shop.
    products: [], variations: [], stockLots: [], transactions: [], accountTxns: [], cashRegisters: [],
    discounts: [], notifications: [], importBatches: [], bookings: [], backups: [],
    brands: [], categories: [], warranties: [], variationTemplates: [], technicians: [],
    contacts: demo.contacts.filter((c) => c.id === WALK_IN).map((c) => ({ ...c, points: 0, openingBalance: 0, advanceBalance: 0 })),
    locations: [{ ...location, invoiceSchemeId: scheme.id }],
    invoiceSchemes: [{ ...scheme, count: 0 }],
    users: demo.users.filter((u) => keepUsers.has(u.id)).map((u) => ({ ...u, locationIds: u.locationIds.filter((l) => l === location.id) })),
    accounts: demo.accounts.map((a) => ({ ...a, openingBalance: 0 })),
    settings: { ...demo.settings, business: { ...demo.settings.business, name: "My Shop" } },
    meta: { ...demo.meta, counters: {} },
  };
}

