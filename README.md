# pos_sible

A modern point-of-sale and back-office app for retail shops: selling, catalog, contacts, purchases, stock, expenses, accounts, reports and settings, in English and Bangla.

It runs in two modes from one codebase: a **browser-only demo** (mock data generated in the browser, no server needed) and an **API mode backed by Postgres**, where the UI (`web/`, Vercel) talks to a separate backend project (`api/`, Coolify; see [docs/backend.md](docs/backend.md)). Screens talk to services; in API mode the same services run on the server, so every business rule is enforced there.

## Status

**Overall: 8 of 8 sub-projects done.** All 87 route pages are live.

| # | Sub-project | Status | Plan |
|---|---|---|---|
| 1 | ✅ Foundation: app shell, auth, data layer, seed data, i18n, theme, Home KPIs, Products list | ✅ Done | [plan](docs/design/plans/2026-09-27-possible-foundation.md) |
| 2 | ✅ POS: register, cart, product grid, split payments, suspend/draft/quotation, receipts, shortcuts | ✅ Done | [plan](docs/design/plans/2026-09-28-possible-pos.md) |
| 3 | ✅ Sales: lists, add/edit sale, detail, payments, shipping, returns, orders, shipments, discounts, CSV import | ✅ Done | [plan](docs/design/plans/2026-10-01-possible-sales.md) |
| 4 | ✅ Catalog: product form and detail, units, categories, brands, variations, warranties, price groups, opening stock, imports, labels | Done | [plan](docs/design/plans/2026-10-02-possible-catalog.md) |
| 5 | ✅ Contacts, Purchases, Stock | Done | [plan](docs/design/plans/2026-10-03-possible-contacts-purchases-stock.md) |
| 6 | ✅ Expenses and Accounts | ✅ Done | [plan](docs/design/plans/2026-10-04-possible-expenses-accounts.md) |
| 7 | ✅ Reports and Dashboard | ✅ Done | [plan](docs/design/plans/2026-10-05-possible-reports-dashboard.md) |
| 8 | ✅ Settings and Admin, plus POS follow-ups | ✅ Done | [plan](docs/design/plans/2026-10-06-possible-settings-admin.md) |

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

**Teams, roles and accountability**
- **Many people, one shop.** Add staff under Settings → Users; each signs in with their own username and password (or use *Switch user* in the account menu on a shared till). Works in both modes; in API mode every sign-in is a server session.
- **Created by / created at / updated by / updated at on every record** (products, contacts, sales, purchases, expenses, accounts, discounts, stock transfers and adjustments, settings lists, users, roles…). They are stamped automatically in one place, so no screen can forget or forge them. Switch them on in any table's *Columns* menu; detail pages show them too, and they export to CSV.
- **Role-based access** with a View / Create / Update / Delete grid per area (customers, suppliers, products, categories/brands/units, purchases, sales, discounts, stock transfers and adjustments, expenses, accounts, users, roles…), plus extras such as *take payments*, *edit price at POS*, *close register*. Enforced in the services (so also on the server), and buttons hide when you can't use them. Nobody can grant more than their own role holds, or edit a more powerful role or user. Roles saved before the finer permissions existed keep exactly what they could do.

**Platform**
- English and Bangla (digits, units, AM/PM), light/dark themes, accent colours, command palette (⌘K), notifications, installable PWA, accessible (axe-checked), reduced-motion friendly micro animations.
- **First-run onboarding**: choose sample data or an empty shop, enter business details; a self-ticking "Get started" checklist.
- **Two modes**: browser-only demo, or **Postgres-backed API mode** with real sign-in (scrypt, sessions, throttling), many users/devices/businesses, server-enforced permissions, audit log, optional public sign-up. See [docs/backend.md](docs/backend.md).

### Good to know
- **Two modes.** The default is the browser-only demo (IndexedDB, single device; a banner appears if the browser refuses to save, and **Backup** exports everything). API mode needs the `api` project and Postgres and is chosen at build time.
- **Settings with no feature behind them yet** (restaurant modules, payment links, purchase orders/requisitions) are hidden rather than shown as dead switches.
- **Email/SMS** "test" buttons are mocked; a real gateway needs a provider key and a worker.
- **Field labels** inside some Business Settings tabs are generated from the setting names and are English-only in Bangla mode.

## Tech stack
Next.js 16 (App Router, Turbopack), React 19 with the React Compiler, TypeScript, Tailwind CSS v4, shadcn/ui on Radix, TanStack Query and Table, Zustand, next-intl, next-themes, zod, recharts, sonner, lucide-react, PostgreSQL (`pg`), vitest, Playwright-core + axe-core for browser checks. Fonts: Inter and Anek Bangla.

## Repository layout

One git repo, two projects that deploy separately:

| Folder | What it is | Deploys to |
|---|---|---|
| `web/` | The Next.js UI (screens, POS, i18n). Also contains the browser-only demo mode. | Vercel, Root Directory = `web` |
| `api/` | The backend: HTTP routes, services, Postgres access, sessions, migrations. | Coolify, Base Directory = `api` (app + Postgres in `api/docker-compose.yml`) |

In API mode the browser only ever talks to the web origin. `web/next.config.ts` rewrites `/api/*` to `BACKEND_URL` (the `api` project), so session cookies stay first-party and no CORS setup is needed. The API accepts those requests because the web origin is listed in its `ALLOWED_ORIGINS`.

```
browser --> https://pos.example.com (Vercel, web/) --/api/*--> https://api.example.com (Coolify, api/) --> Postgres
```

The business rules (`lib/data`, `lib/domain`) exist in both projects: `web/` runs them in the browser for the demo mode, `api/` runs them on the server. They are copies, so a rule change must be made in both (the API test suite and the web test suite each cover their own copy).

## Running the project

**Requirements:** Node.js 20.9+ (22 recommended), npm, and Docker for the API.

### A. Browser-only demo (no backend)
```bash
cd web
npm install
npm run dev            # http://localhost:3000
```
Sign in as `admin` / `112233` (also `cashier`, `rafiq`, `nazmul`, all `112233`). A welcome wizard appears the first time: keep the sample shop or start empty. Data is generated on first load (about six months of history) and saved in the browser; clear site data to reset.

Production build: `npm run build && npm start`.

### B. Both projects locally (real sign-in, many users and devices)
```bash
# terminal 1: API + Postgres on http://localhost:3001
cd api
POS_SEED_DEMO=true docker compose up -d --build

# terminal 2: the UI on http://localhost:3000
cd web
npm install
cp .env.example .env.local      # NEXT_PUBLIC_DATA_MODE=api, BACKEND_URL=http://localhost:3001
npm run dev:api
```
Migrations run on the API's first request. Sign in as `admin` / `112233` (the demo shop). The API reads `ALLOWED_ORIGINS` (default `http://localhost:3000`); change it if the UI runs on another port. The API sets `Secure` cookies, which Chrome and Firefox accept on `http://localhost`; Safari does not, so use HTTPS there.

To work on the API without Docker for the app itself: `cd api && docker compose up -d db && cp .env.example .env.local && npm install && npm run dev` (port 3001).

### C. Deploying: web on Vercel, API on Coolify

**API on Coolify.** Create a Docker Compose resource from this repo with Base Directory `api` (it uses `api/docker-compose.yml`, which runs the API and Postgres 16). Give the `api` service a domain such as `api.example.com`. Set:

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | `postgres` | Database password. Set a long random one. It only applies when the data volume is first created; changing it later needs `ALTER USER postgres PASSWORD '...'` in the db container, or `docker compose down -v` (wipes all data). |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | The exact origin(s) of the web app, comma separated, e.g. `https://pos.example.com`. A Vercel preview URL is a different origin and must be added to be allowed. |
| `POS_SEED_DEMO` | `false` | `true` creates the demo shop (`admin` / `112233`). Leave off for real use. |
| `POS_ALLOW_SIGNUP` | `false` | `true` offers `/signup`. The image has no CLI, so create your first business with this (then turn it off), or run `npm run db:create-business` from `api/` with `DATABASE_URL` pointing at the database. |
| `API_PORT`, `DB_PORT` | `3001`, `5432` | Host ports for local use. Postgres listens on `127.0.0.1` only. |

**Web on Vercel.** Import the repo with Root Directory `web`. Set these in the project settings (they are read at build time, so redeploy after changing them):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `api` |
| `BACKEND_URL` | `https://api.example.com` (no trailing slash) |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `true` only if the API has `POS_ALLOW_SIGNUP=true` |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | `true` only if the API seeds the demo shop |

Run a single API replica (each business's data is cached in server memory). Sessions use `Secure` cookies, which is fine on Vercel's HTTPS domain. Full-database restore uploads can reach 30 MB; this was checked at 12 MB through the rewrite when self-hosted, but not on Vercel, whose request body limits apply there.

### Checks
```bash
# web/
npx next typegen && npm run typecheck   # typegen creates the generated LayoutProps type on a clean checkout
npm run lint
npm test                                # unit tests (no database needed)
npm run build
# with a built app running (npm start):
npm run e2e                             # every route, EN/light + BN/dark + tablet, axe accessibility
npm run e2e:onboarding                  # first-run wizard and checklist
npm run e2e:team                        # two users, who-did-what columns, role permission grid

# api/
npm run typecheck
npm test                                # tests/server/* need Postgres (TEST_DATABASE_URL, default
                                        # postgres://postgres@127.0.0.1:5433/pos_sible_test), skipped without one

# both running (section B), from web/:
E2E_API=1 npm run e2e                   # same sweep against the Postgres-backed stack
npm run e2e:api                         # sign-in, multi-device, permissions, cashier POS sale
```
The e2e scripts drive Chromium through `playwright-core`; set `CHROMIUM_PATH` if it is not at `/opt/pw-browsers/chromium`, and `E2E_URL` for another port.

### Troubleshooting
- *Sign-in says "origin" or every request returns 403 `forbidden_origin`*: the web origin is missing from the API's `ALLOWED_ORIGINS` (scheme and host must match exactly, no trailing slash).
- */api calls return 404 on Vercel*: `BACKEND_URL` was not set at build time; set it and redeploy.
- *"DATABASE_URL is not set"*: set it for the API (compose does this for you).
- *Sign-in page shows no demo buttons in API mode*: set `NEXT_PUBLIC_SHOW_DEMO_LOGINS=true` on the web project and rebuild.
- *Changed mode but nothing changed*: `NEXT_PUBLIC_DATA_MODE` is read at build time; rebuild.
- *Data looks stale after upgrading*: clear site data (demo) or run `npm run db:migrate` from `api/` (Postgres).

## How the code is organised
```
web/                  the Next.js UI project
  app/                routes: (auth) login, (app) back-office screens, (pos) full-screen POS
  components/         ui (shadcn), shared (DataTable, FilterBar, PageHeader, Money, dialogs), layout
  features/           one folder per module: pos, products, sales ...
  lib/data/           schemas (zod), seed, services (the "API"), hooks (TanStack Query), store
  lib/domain/         pure business maths: totals, pricing, stock allocation, payments, rewards, ledger
  lib/pos/            cart operations, selectors, hotkeys, barcode
  lib/auth/           session, permissions, assertCan
  lib/i18n/           formatting and locale
  messages/           generated en.json and bn.json
  scripts/            messages.mjs, the single source of all UI text
api/                  the backend project
  app/api/            route handlers: rpc, auth (login, logout, me, signup), health
  lib/server/         Postgres pool, schema and migrations, sessions, per-business store, RPC dispatch
  lib/data, lib/domain, lib/pos, lib/auth/   copies of the shared business rules the services need
  scripts/db.ts       migrate, seed, create-business
  tests/server/       backend, tenant isolation and fuzz tests (real Postgres)
docs/                 design specs, implementation plans, backend notes
```

### Conventions
- **Data layer:** UI talks to hooks; hooks call services; services are the only code that touches the database. Every write goes through `commit()`, which rolls back if anything throws. Services start with a simulated delay, check permissions with `assertCan`, and throw typed errors.
- **Stock** is kept as lots. Sales allocate FIFO or LIFO and record cost, so profit, returns and edits can restore stock exactly.
- **Text:** all UI strings live in `scripts/messages.mjs` as English/Bangla pairs. Run `node scripts/messages.mjs messages` to regenerate `messages/*.json`; never edit those by hand. A test checks both languages have the same keys.
- **Money** always goes through `roundMoney` and the `useFormat` hook (Bangla digits in Bangla mode).
- **Permissions** gate routes (`RequirePermission`), buttons (`useCan`) and services (`assertCan`).
- **Tests:** domain maths and every service have unit tests; `npm run e2e` loads every route in both languages and themes and runs axe accessibility checks.

## Documentation
Design specs are in `docs/design/specs/` and step-by-step plans in `docs/design/plans/`. Each sub-project gets a spec, then a plan, then a build on its own branch merged into `main`.
