# pos_sible

A modern point-of-sale and back-office app for retail shops: selling, catalog, contacts, purchases, stock, expenses, accounts, reports and settings, in English and Bangla.

It runs in two modes from one codebase: a **browser-only demo** (mock data generated in the browser, no server needed) and an **API mode backed by Postgres** inside the same Next.js project (see [docs/backend.md](docs/backend.md)). Screens talk to services; in API mode the same services run on the server, so every business rule is enforced there.

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

## Features

**Selling**
- **POS** (`/pos`): open/close a cash register, barcode/SKU scanning, product grid with category/brand/featured filters, variations, serial/IMEI numbers, line discounts, order discount/tax/shipping zones, reward points, split payments (cash, card, cheque, bank, bKash, Nagad, Rocket, Upay and custom), suspend/resume, draft, quotation, credit sale, recent transactions, thermal (58/80 mm) and A4 receipts with Code 128, customizable keyboard shortcuts, weighing-scale barcodes, technician and service-staff pickers, walk-in customers, quick add customer. Works on tablets (Products/Cart switch) and desktops.
- **Sales**: all sales, drafts, quotations, proforma; add/edit sale (shipping, extra expenses, payments, subscriptions/recurring, commission agent, documents); sale detail with payments and printing; convert draft/quotation to invoice; sell returns; sales orders (view, convert to a sale, delete); shipments; rule-based discounts; CSV import with revert history.
- **Customers**: groups with price lists, credit limits and pay terms, opening/advance balance, reward points that **expire** after a configurable period.

**Catalog and stock**
- Products (single, variable, combo), units with sub-units, categories, brands, warranties, variation templates, selling price groups, tax rates and groups, SKU/barcode types, expiry dates and lots, images, rack/row/position.
- Print barcode labels (sheet presets), update prices by spreadsheet, import products and opening stock from CSV, bulk actions, product history.
- Stock per location with FIFO/LIFO costing, stock transfers (pending / in transit / completed), stock adjustments (normal/abnormal), low-stock and expiry alerts, optional "stop selling expired stock".

**Buying**
- Suppliers, purchases (statuses, lots, expiry, partial payments, additional expenses, attach a document, **import lines from CSV**), purchase returns, pay-due flows.

**Money**
- Expenses (categories, sub-categories, refunds, recurring), payment accounts and account types, deposits, transfers, account book, balance sheet, trial balance, cash flow, payment account report. Books are double-entry and reconcile with stock to the cent.

**Reports and dashboard**
- Home dashboard (KPIs with location/date filters, sales chart, top products, dues), profit & loss (by product, category, brand, location, invoice, date, customer), purchase & sale, tax, customers & suppliers, customer groups, stock, stock expiry, stock adjustment, trending products, items, product purchase/sell, purchase/sell payment, expense, register, sales representative, table. Print and CSV export everywhere.

**Settings and admin**
- Business settings (16 tabs: business, tax, product, contact, sale, POS, purchases, payment, dashboard, system, prefixes, reward points, modules, custom labels, email, SMS), locations, invoice schemes and layouts (live preview), barcode sheets, receipt printers, tax rates, **users and roles** with a permission matrix, backup/restore (JSON), module switches, profile (password, photo, bank details), calendar. Every setting takes effect immediately.

**Platform**
- English and Bangla (digits, units, AM/PM), light/dark themes, accent colours, command palette (⌘K), notifications, installable PWA, accessible (axe-checked), reduced-motion friendly micro animations.
- **First-run onboarding**: choose sample data or an empty shop, enter business details; a self-ticking "Get started" checklist.
- **Two modes**: browser-only demo, or **Postgres-backed API mode** with real sign-in (scrypt, sessions, throttling), many users/devices/businesses, server-enforced permissions, audit log, optional public sign-up. See [docs/backend.md](docs/backend.md).

### Good to know
- **Two modes.** The default is the browser-only demo (IndexedDB, single device; a banner appears if the browser refuses to save, and **Backup** exports everything). API mode needs Postgres and is chosen at build time.
- **Settings with no feature behind them yet** (restaurant modules, payment links, purchase orders/requisitions) are hidden rather than shown as dead switches.
- **Email/SMS** "test" buttons are mocked; a real gateway needs a provider key and a worker.
- **Field labels** inside some Business Settings tabs are generated from the setting names and are English-only in Bangla mode.

## Tech stack
Next.js 16 (App Router, Turbopack), React 19 with the React Compiler, TypeScript, Tailwind CSS v4, shadcn/ui on Radix, TanStack Query and Table, Zustand, next-intl, next-themes, zod, recharts, sonner, lucide-react, PostgreSQL (`pg`), vitest, Playwright-core + axe-core for browser checks. Fonts: Inter and Anek Bangla.

## Running the project

**Requirements:** Node.js 20.9+ (22 recommended) and npm. Postgres 14+ only for API mode (Docker is the easiest way).

### A. Browser-only demo (no database)
```bash
npm install
npm run dev            # http://localhost:3000
```
Sign in as `admin` / `112233` (also `cashier`, `rafiq`, `nazmul`, all `112233`). A welcome wizard appears the first time: keep the sample shop or start empty. Data is generated on first load (about six months of history) and saved in the browser; clear site data to reset.

Production build: `npm run build && npm start`.

### B. With Postgres (real sign-in, many users and devices)
```bash
npm install
docker compose up -d                 # Postgres 16 on :5432 (or point DATABASE_URL at your own)
cp .env.example .env.local           # DATABASE_URL, demo seeding, sign-up switch
npm run dev:api                      # http://localhost:3000, migrations run on first request
```
Or build for production: `npm run db:migrate && npm run db:seed && npm run build:api && npm start`. `NEXT_PUBLIC_DATA_MODE` is baked in at build time, so build the mode you intend to run.

Sign in as `admin` / `112233` (the demo shop). Create your own business with
`npm run db:create-business -- "My Shop" myname 'a good password' "My Name"`, or set `POS_ALLOW_SIGNUP=true` and `NEXT_PUBLIC_ALLOW_SIGNUP=true` to offer `/signup`. Set `POS_SEED_DEMO=false` (and never publish the demo passwords) for a real deployment. All variables are explained in [docs/backend.md](docs/backend.md).

### Checks
```bash
npx tsc --noEmit    # typecheck
npm run lint
npm test            # 439 unit/integration tests. tests/server/* need Postgres (TEST_DATABASE_URL,
                    # default postgres://postgres@127.0.0.1:5433/pos_sible_test) and are skipped without one
npm run build
# with a built app running (npm start):
npm run e2e                           # every route, EN/light + BN/dark + tablet, axe accessibility
npm run e2e:onboarding                # first-run wizard and checklist
E2E_API=1 npm run e2e                 # same sweep against the Postgres build
npm run e2e:api                       # sign-in, multi-device, permissions, cashier POS sale
```
The e2e scripts drive Chromium through `playwright-core`; set `CHROMIUM_PATH` if it is not at `/opt/pw-browsers/chromium`, and `E2E_URL` for another port.

### Troubleshooting
- *"DATABASE_URL is not set"*: you built API mode without it; copy `.env.example` to `.env.local`.
- *Sign-in page shows no demo buttons in API mode*: set `NEXT_PUBLIC_SHOW_DEMO_LOGINS=true` and rebuild.
- *Changed mode but nothing changed*: `NEXT_PUBLIC_DATA_MODE` is read at build time; rebuild.
- *Data looks stale after upgrading*: clear site data (demo) or run `npm run db:migrate` (Postgres).

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
- **Tests:** domain maths and every service have unit tests; `npm run e2e` loads every route in both languages and themes and runs axe accessibility checks.

## Documentation
Design specs are in `docs/superpowers/specs/` and step-by-step plans in `docs/superpowers/plans/`. Each sub-project gets a spec, then a plan, then a build on its own branch merged into `main`.
