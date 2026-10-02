# pos_sible

A modern point-of-sale and back-office app for retail shops: selling, catalog, contacts, purchases, stock, expenses, accounts, reports and settings, in English and Bangla.

It is **frontend only**. All data is mock data generated in the browser and saved to local storage, so every screen can be used, reloaded and demoed without a server. Services are written so a real API can replace them later without touching the UI.

## Status

**Overall: 8 of 8 sub-projects done.** All 87 route pages are live.

| # | Sub-project | Status | Plan |
|---|---|---|---|
| 1 | ✅ Foundation: app shell, auth, data layer, seed data, i18n, theme, Home KPIs, Products list | ✅ Done | [plan](docs/superpowers/plans/2026-09-27-possible-foundation.md) |
| 2 | ✅ POS: register, cart, product grid, split payments, suspend/draft/quotation, receipts, shortcuts | ✅ Done | [plan](docs/superpowers/plans/2026-09-28-possible-pos.md) |
| 3 | ✅ Sales: lists, add/edit sale, detail, payments, shipping, returns, orders, shipments, discounts, CSV import | ✅ Done | [plan](docs/superpowers/plans/2026-10-01-possible-sales.md) |
| 4 | ✅ Catalog: product form and detail, units, categories, brands, variations, warranties, price groups, opening stock, imports, labels | Done | [plan](docs/superpowers/plans/2026-10-02-possible-catalog.md) |
| 5 | ✅ Contacts, Purchases, Stock | Done | [plan](docs/superpowers/plans/2026-10-03-possible-contacts-purchases-stock.md) |
| 6 | ✅ Expenses and Accounts | ✅ Done | [plan](docs/superpowers/plans/2026-10-04-possible-expenses-accounts.md) |
| 7 | ✅ Reports and Dashboard | ✅ Done | [plan](docs/superpowers/plans/2026-10-05-possible-reports-dashboard.md) |
| 8 | ✅ Settings and Admin, plus POS follow-ups | ✅ Done | [plan](docs/superpowers/plans/2026-10-06-possible-settings-admin.md) |

### What works today
- Sign in (demo `admin` / `112233`), app shell, collapsible sidebar, command palette (⌘K), notifications, location switcher, one-click light/dark theme, EN/BN toggle.
- Home dashboard KPI tiles with location and date filters.
- Products list with filters, stock report tab, bulk actions and CSV export.
- Full POS at `/pos`: register open/close, barcode/SKU scanning, grid, variations, serials, line discounts, order discount/tax/shipping, reward points, split payments (cash, card, bKash, Nagad and more), suspend/resume, draft, quotation, credit sale, recent transactions, thermal and A4 receipts with Code 128, keyboard shortcuts, weighing-scale barcodes.
- Sales: all sales, drafts and quotations lists, add/edit sale (shipping, additional expenses, payments, subscriptions, linked orders), sale detail, payments, convert to invoice, sell returns, sales orders, shipments, discounts and CSV import with revert.

- Settings and admin: business settings (16 tabs, driven by the settings schema, with a shortcut recorder and mocked test email/SMS), locations, invoice schemes and layouts (with a live preview), barcode sheets, printers, tax rates and groups, users and roles (permission matrix), backup and restore, module switches (hide menu items and routes), profile and calendar.

### Known gaps
Some parked POS follow-ups from the Settings plan (task 11) are not done: only the minimum-redeem-points rule and removal of the unused `posService.bySku` were completed. Most field labels inside the Business Settings tabs are generated from the setting names and are English-only in Bangla mode. The layout preview is a sample receipt that follows the toggles, not the real receipt components. The final hardening pass (full accessibility audit, a Playwright suite) was not done; every route was only smoke-tested in the browser.

## Tech stack
Next.js 16 (App Router, Turbopack), React 19 with the React Compiler, TypeScript, Tailwind CSS v4, shadcn/ui on Radix, TanStack Query and Table, Zustand (persisted), next-intl, next-themes, zod, recharts, sonner, lucide-react, vitest. Fonts: Inter and Anek Bangla.

## Getting started
```bash
npm install
npm run dev        # http://localhost:3000
```
Sign in with `admin` / `112233` (also `cashier`, `rafiq`, `nazmul`, all with `112233`). Data is seeded on first load (about six months of history). Clear site storage to reset it.

```bash
npm test           # vitest, 378 tests
npx tsc --noEmit   # typecheck
npm run lint
npm run build
```

## How the code is organised
```
app/            routes: (auth) login, (app) back-office screens, (pos) full-screen POS
components/     ui (shadcn), shared (DataTable, FilterBar, PageHeader, Money, dialogs), layout
features/       one folder per module: pos, products, sales ...
lib/data/       schemas (zod), seed, services (the "API"), hooks (TanStack Query), store
lib/domain/     pure business maths: totals, pricing, stock allocation, payments, rewards, ledger
lib/pos/        cart operations, selectors, hotkeys, barcode
lib/auth/       session, permissions, assertCan
lib/i18n/       formatting and locale
messages/       generated en.json and bn.json
scripts/        messages.mjs, the single source of all UI text
docs/           design specs and implementation plans
```

### Conventions
- **Data layer:** UI talks to hooks; hooks call services; services are the only code that touches the database. Every write goes through `commit()`, which rolls back if anything throws. Services start with a simulated delay, check permissions with `assertCan`, and throw typed errors.
- **Stock** is kept as lots. Sales allocate FIFO or LIFO and record cost, so profit, returns and edits can restore stock exactly.
- **Text:** all UI strings live in `scripts/messages.mjs` as English/Bangla pairs. Run `node scripts/messages.mjs messages` to regenerate `messages/*.json`; never edit those by hand. A test checks both languages have the same keys.
- **Money** always goes through `roundMoney` and the `useFormat` hook (Bangla digits in Bangla mode).
- **Permissions** gate routes (`RequirePermission`), buttons (`useCan`) and services (`assertCan`).
- **Tests:** domain maths and every service have unit tests; screens are checked in the browser in both languages and themes.

## Documentation
Design specs are in `docs/superpowers/specs/` and step-by-step plans in `docs/superpowers/plans/`. Each sub-project gets a spec, then a plan, then a build on its own branch merged into `main`.
