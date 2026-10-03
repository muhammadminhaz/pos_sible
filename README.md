# POS-sible

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

**Analytics (`/analytics`, needs `report.view`)**
- Charts for the questions owners ask, on the same location and date-range filters and card style as the dashboard. **Overview**: net sales, gross and net profit, margin, orders, average order value and what customers and suppliers owe, each against the previous period of equal length, plus sales and profit over time. **Sales**: busiest weekday and hour heatmap, how customers pay, sales by location, discounts and returns. **Products**: top products by profit and sales, an 80/20 (ABC) chart, dead stock (nothing sold in 60 days, valued at cost). **Customers**: top customers, new vs returning by month, repeat rate, money owed by age. **Inventory**: items that will run out within 30 days at the current selling pace, with a suggested reorder quantity. **Expenses**: where the money goes and expenses as a share of sales.
- Charts are Highcharts, drawn in the app's own colours: hover for values, click a legend entry to hide or show a series. The page is a 12-column card grid: drag a card by the grip at its top centre to move it, drag the mark in its bottom-right corner to resize it, and the other cards make room. Each card has a minimum and maximum size (charts stay at least 4 columns wide and 7 rows tall, headline tiles at most 7 rows tall; width can always grow to the full row) so none can vanish or fill the page. Layouts are saved per section in this browser (`posible:v1:analytics-layout`); **Reset layout** returns to the default. On phones the cards stack and the layout is fixed. **Also show** adds other segments' cards below one shared date range and location, with a toast and a scroll to the new cards. The range picker has an **All** option from the first record to today.
- Read-only, no new tables: `lib/data/services/reports/analytics.ts` (also in `api/`, exposed as `analyticsReports`). Returns are subtracted and profit uses lot cost, so totals reconcile with Profit / loss (checked in `analytics.test.ts`). Every chart has a screen-reader table.
- Skipped from the original plan as low value for now: cohorts, RFM, basket analysis, forecasts, targets, saved views.

**Platform owner console (`/admin`)**
- For the person who sells the software. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (set in the API's environment and `docker-compose.yml`; defaults `minhaz` / `11111111`; set your own before going live).
- A sidebar with **Dashboard** (totals, who needs attention, package mix, biggest storage), **Businesses**, **Users** (accounts per business against its limit), **Subscriptions** (edit each package's name, user limit and monthly price) and **Revenue** (monthly revenue and yearly run rate estimated from active subscriptions, by package, renewals due, new businesses per month).
- **Add a business** with a name, a username, a password and a package, plus an optional email, phone number (searchable country-code dropdown with flags, validated per country) and end date. **Renew** a subscription for 1, 3, 6 or 12 months (an active one is extended from its end date, a cancelled or lapsed one counts from today) instead of typing dates; **Cancel** a subscription to stop everyone in that business from using the software (they are signed out at once and the sign-in page tells them to renew and contact their administrator; renewing brings them back). **Manage** also changes the package and contact details, and can **set a new password** for the owner (passwords can be replaced, never viewed; the owner is signed out). **Delete** removes a business and all its data for good, after you type its username.
- A cancelled or expired business cannot sign in (the message says to renew the subscription and contact the administrator) and any open session ends on its next request. The package's user limit is enforced by the server.
- You see each business's package, user count and storage only: no products, customers, sales or staff, and there is no way to sign in as a business. Businesses are fully isolated from each other (every query is scoped to the signed-in user's business).

**Platform**
- **SEO and sharing**: proper page titles ("Products · POS-sible", in the current language), description, keywords, canonical links, Open Graph and Twitter cards with a generated 1200×630 preview image, JSON-LD (software application), `robots.txt`, `sitemap.xml` and a web manifest. Sign-in pages are indexable; the shop and the admin console are `noindex`.
- English and Bangla (digits, units, AM/PM), light/dark themes, accent colours, command palette (⌘K), notifications, installable PWA, accessible (axe-checked), reduced-motion friendly micro animations (pointer-following spotlight on cards, count-up figures, shine and press on buttons, staggered table rows, shimmer loading, tick/pop on checkboxes, animated active-page markers).
- **First-run onboarding**: choose sample data or an empty shop, enter business details; a self-ticking "Get started" checklist.
- **Two modes**: browser-only demo, or **Postgres-backed API mode** with real sign-in (scrypt, sessions, throttling), many users/devices/businesses, server-enforced permissions, audit log, optional public sign-up. See [docs/backend.md](docs/backend.md).

### Good to know
- **Who can read what.** Listing or opening users, roles and printers needs `user.view`, `role.view` and `settings.printer`. Pickers (sales agent, "created by" names) still work for everyone: they get names only, without usernames, emails, bank details or role permissions.
- **Notifications.** The bell lists alerts worked out from your data (overdue invoices and bills, low or expired stock, stuck transfers...). A row counts as read once it has been on screen for a moment, so the badge falls as you scroll through the list; **Mark all as read** does it at once. Alerts older than 30 days are deleted, and one you have read but not fixed comes back unread after 3 days.
- **Scrollbars** (page, tables, lists) are thin and in the accent colour, fade out when nothing has scrolled for a moment, and fade back on scroll or when the pointer goes to the edge.
- **Two modes.** The default is the browser-only demo (IndexedDB, single device; a banner appears if the browser refuses to save, and **Backup** exports everything). API mode needs the `api` project and Postgres and is chosen at build time.
- **Settings with no feature behind them yet** (restaurant modules, payment links, purchase orders/requisitions) are hidden rather than shown as dead switches.
- **Email/SMS** "test" buttons are mocked; a real gateway needs a provider key and a worker.
- **Field labels** inside some Business Settings tabs are generated from the setting names and are English-only in Bangla mode.


### Modules, free accounts, demo accounts and staff sign-in

- **Subscription = package + modules.** A package sets the user limit and base price; each module (POS, Sales, Purchases, Stock, Expenses, Accounts, Reports) adds its own monthly price (edit under `/admin` → Subscriptions). Dashboard, products, contacts and settings are always included. Modules a business does not have are hidden in the menu, blocked on its pages and refused by the server (`module_off`).
- **Per-person modules.** Under Settings → Users the owner can narrow what each person may use (none picked = everything the business has).
- **Free account.** Switch on in `/admin` → Manage: price 0, no end date, every module, unlimited users.
- **Demo account.** Tick "Demo account" when adding a business: three months of random sample data and no welcome wizard. Real business accounts still get the wizard; the browser-only demo never shows it.
- **Staff sign-in.** The login page has "Business owner" and "Staff member" tabs. Staff enter the **business code**, their own username and the password the owner set for them under Settings → Users. A business code is a short unique name (3 to 40 letters, digits, dot, dash or underscore) chosen in the admin console when the business is created; it defaults to the owner's username and can be changed later. Because staff are looked up inside their business, the same staff username (`till`, `rafiq`…) can exist in many businesses; an owner still signs in with just their username, so owner usernames are unique everywhere. Owners can see the code under Settings → Users. The demo shop's code is `demo` (the quick-fill buttons on the sign-in page use it).
- **UI components (React Bits).** Toasts are SwipeToast (`web/lib/toast.tsx`, same `toast.success/error/warning/info` calls as before; the burning underline is green, red, amber or blue by status; swipe down to dismiss). Every dropdown is GlideSelect (`web/components/ui/select.tsx` keeps the old `Select` composition; `MultiSelect` is the ticked variant used for locations and modules). The menu is portalled to the page body so dialogs and tables never clip it.
- **Dashboard.** Soft canvas of large rounded cards: sales and purchases as split-bar headline cards, a dark Net card, expenses, dues and returns, the sales trend, top products, and the due, stock and expiry tables with status pills. Same figures as before; every card links to its full report.
- **Dashboard motion.** Cards light a gradient accent border on hover that fades in from the top-right and bottom-left corners (`.card-glow`). The period picker is React Bits RubberSegment (`web/components/ui/rubber-segment.tsx`): the thumb stretches across the old and new slot, and hides itself when a custom date range matches no preset.
- **Navigation feedback.** A thin bar sweeps left to right along the top of the window from the moment an in-app link is pressed until the next screen is ready (`NavigationProgress`).
- **Export file names.** Every CSV is named `<business>_<what>_<date>_<time>.csv`, e.g. `sosa_sales_2026-10-03_14-05.csv` (`exportFileName` in `web/components/shared/DataTable/export.ts`).
- **Notifications.** The bell re-derives alerts from the data before every read and re-checks every 5 minutes and on focus.

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
browser --> https://pos-sible.vercel.app (Vercel, web/) --/api/*--> https://pos-sible.158.178.146.95.sslip.io (Coolify, api/) --> Postgres
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
cp .env.example .env            # POSTGRES_PASSWORD, ALLOWED_ORIGINS=http://localhost:3000, ...
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

# terminal 2: the UI on http://localhost:3000
cd web
npm install
cp .env.example .env.local      # NEXT_PUBLIC_DATA_MODE=api, BACKEND_URL=http://localhost:3001
npm run dev:api
```
Migrations run on the API's first request. Sign in as `admin` / `112233` (the demo shop; its staff use business code `demo`). The platform owner console is at `/admin` (default `minhaz` / `11111111`). The API reads `ALLOWED_ORIGINS` (default `http://localhost:3000`); change it if the UI runs on another port. The API sets `Secure` cookies, which Chrome and Firefox accept on `http://localhost`; Safari does not, so use HTTPS there.

To work on the API without Docker for the app itself: `cd api && cp .env.example .env && docker compose up -d db && npm install && npm run dev` (port 3001, database on `127.0.0.1:5435`).

### C. Deploying: web on Vercel, API on Coolify

**API on Coolify.** Create a Docker Compose resource from this repo with Base Directory `api` (it uses `api/docker-compose.yml`, which runs the API and Postgres 16). The compose file already declares the public domain (`SERVICE_FQDN_API_3000: https://pos-sible.158.178.146.95.sslip.io`), which Coolify uses for routing and the TLS certificate. Change that line if the domain changes. Set these variables in Coolify:

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | none, required | Database password. The compose file refuses to start without it. Set a long random one in Coolify. It only applies when the data volume is first created; changing it later needs `ALTER USER postgres PASSWORD '...'` in the db container, or `docker compose down -v` (wipes all data). |
| `ALLOWED_ORIGINS` | `https://pos-sible.vercel.app` | The exact origin(s) of the web app, comma separated, no trailing slash. A Vercel preview URL is a different origin and must be added to be allowed. For local development `.env` sets `http://localhost:3000`. |
| `POS_SEED_DEMO` | `false` | `true` creates the demo shop (`admin` / `112233`). Leave off for real use. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `minhaz` / `11111111` | Platform owner login for `/admin` on the web app. Passed to the API container by `docker-compose.yml`. Set your own password in Coolify before going live; the API logs a warning in production while the default is in use. |
| `POS_ALLOW_SIGNUP` | `false` | `true` offers `/signup`. The image has no CLI, so create your first business with this (then turn it off), or run `npm run db:create-business` from `api/` with `DATABASE_URL` pointing at the database. |
| `DB_PORT` | `5435` | Host port for Postgres, bound to `127.0.0.1` only (not 5432, so it cannot clash with another database on a shared Coolify server). |
| `API_PORT` | `3001` | Local only (`docker-compose.local.yml`). The compose file Coolify uses publishes no host port. |

**Web on Vercel.** Import the repo with Root Directory `web`. Set these in the project settings (they are read at build time, so redeploy after changing them):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `api` |
| `BACKEND_URL` | `https://pos-sible.158.178.146.95.sslip.io` (no trailing slash) |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `true` only if the API has `POS_ALLOW_SIGNUP=true` |
| `NEXT_PUBLIC_SITE_URL` | The public address of the web app, e.g. `https://pos-sible.vercel.app` (default). Used for canonical links, the Open Graph / Twitter preview image, the sitemap and robots.txt. Set it when you move to your own domain. |
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
npm run e2e:admin                       # (API mode) /admin: add, cancel, renew, reset password, delete, isolation

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
