# pos_sible — Foundation Design

- **Date:** 2026-09-27
- **Status:** Approved
- **Source of requirements:** `Product.md`, the inventory of the Sarkar POS / UltimatePOS demo at demo.posghor.com

## 1. Goal and scope

Rebuild the full UI of the Sarkar POS product as a modern, frontend-only Next.js app. It must have **feature parity with every screen in `Product.md`**, and it runs on a realistic mock data layer that can later be swapped for a real API.

The work is split into sub-projects. Each gets its own implementation plan:

| # | Sub-project | Covers (`Product.md` sections) |
|---|---|---|
| 1 | **Foundation** (this spec, in full detail) | Design system, app shell, shared components, data layer, domain logic, auth, i18n |
| 2 | POS screen | §3.5 POS |
| 3 | Sales | §3.5 (all sales, add sale, drafts, quotations, sales orders, returns, shipments, discounts, import) |
| 4 | Catalog | §3.3 |
| 5 | Contacts, Purchases, Stock | §3.2, §3.4, §3.6 |
| 6 | Expenses and Accounts | §3.7, §3.8 |
| 7 | Reports and Dashboard | §3.1, §3.9 |
| 8 | Settings and Admin | §3.10, §3.11, §3.12 |

**Gaps from `Product.md` §6 that this build fills:**
- list pages for Stock Transfers and Stock Adjustments
- a working Customer Groups page
- Users and Roles pages
- a dashboard with charts

**Out of scope:**
- a real backend or database
- real payment gateways (Razorpay and Stripe keys are only stored)
- real SMS or email sending (the test buttons show a simulated result)
- physical printer drivers (printing uses the browser print dialog with print CSS)

## 2. Decisions

| Topic | Decision |
|---|---|
| Data | Frontend only. Zustand stores persisted to localStorage, behind an async service layer |
| Visual direction | Calm and modern (Linear/Stripe style), light and dark |
| Languages | English and Bangla, toggled at runtime, with locale-aware numerals and currency |
| Stack | Next.js 16.3 App Router, React 19.2, Tailwind v4, shadcn/ui on Radix, TanStack Table, TanStack Query, react-hook-form + Zod, Zustand, next-intl, next-themes, Recharts, lucide-react, cmdk, sonner, date-fns |
| Tests | Vitest for domain logic and services, Playwright smoke flows |

## 3. Architecture

### 3.1 Rendering
- Layouts are Server Components that render the shell frame. Screens are Client Components that read data through TanStack Query hooks calling `lib/data/services`.
- Stores rehydrate from localStorage on the client. A `<DataGate>` shows skeletons until hydration finishes, which avoids a flash of empty data.
- There is no `proxy.ts`. The auth guard runs on the client in the `(app)` and `(pos)` layouts and redirects to `/login` when there's no session.

### 3.2 i18n
- next-intl in "without i18n routing" mode. The locale (`en` | `bn`) lives in the `NEXT_LOCALE` cookie and is read in `i18n/request.ts`. The toggle writes the cookie and calls `router.refresh()`.
- Messages live in `messages/{en,bn}.json`, namespaced by module (`common`, `nav`, `pos`, `sales`, …).
- `useFormat()` returns `money(n)`, `number(n)`, `date(d)`, `dateTime(d)`, and `percent(n)` via `Intl`:
  - `bn-BD` uses Bangla digits, and `en-BD` uses Latin digits.
  - The currency symbol is ৳, and its placement and precision come from Settings.
- Fonts: Inter for Latin, and Hind Siliguri for Bangla (via `next/font`, as the CSS font stack fallback).

### 3.3 Routes

```
app/
  layout.tsx                      html/body, fonts, providers (theme, intl, query, toaster)
  page.tsx                        redirect → /home
  (auth)/login/page.tsx
  (app)/layout.tsx                AppShell (sidebar, header, command palette) + auth guard
  (app)/home/page.tsx
  (app)/calendar/page.tsx
  (app)/profile/page.tsx
  (app)/contacts/suppliers | customers | customer-groups | technicians | import
  (app)/products/page | new | [id] | [id]/edit | update-price | labels | variations | import
          | import-opening-stock | price-groups | units | categories | brands | warranties
  (app)/purchases/page | new | [id] | [id]/edit | returns | returns/new
  (app)/sales/page | new | [id] | [id]/edit | orders | drafts | quotations | returns
          | returns/new | shipments | discounts | import
  (app)/stock/transfers | transfers/new | transfers/[id] | adjustments | adjustments/new
  (app)/expenses/page | new | [id]/edit | categories
  (app)/accounts/page | [id] | balance-sheet | trial-balance | cash-flow | payment-report
  (app)/reports/profit-loss | purchase-sale | tax | contacts | customer-groups | stock
          | stock-expiry | stock-adjustment | trending-products | items | product-purchase
          | product-sell | purchase-payment | sell-payment | expense | register
          | sales-representative | table
  (app)/settings/business | locations | invoices | barcodes | printers | tax-rates
          | users | roles | backup | modules
  (pos)/layout.tsx                full-screen, auth guard, register gate
  (pos)/pos/page.tsx
```

Rules:
- `sales/new?status=draft|quotation|proforma` sets the default status.
- The "List POS" view is `/sales?channel=pos`.

### 3.4 Folder layout

```
components/ui/         shadcn primitives restyled with tokens
components/layout/     AppShell, Sidebar, Header, CommandPalette, LocaleToggle,
                       ThemeToggle, LocationSwitcher, Calculator, ProfitPopover
components/shared/     DataTable, FilterBar, PageHeader, StatCard, StatusBadge, Money,
                       EmptyState, DateRangePicker, form fields, ProductSearch,
                       LineItemsEditor, PaymentFields, ContactDialog, ImportWizard,
                       PrintPreview, ConfirmDialog
features/<module>/     screens, table columns, forms, module-specific widgets
lib/data/schemas/      Zod schemas → types
lib/data/seed/         deterministic seed generator
lib/data/store/        Zustand stores (persist)
lib/data/services/     async API used by the UI
lib/data/hooks/        TanStack Query hooks per service
lib/domain/            pure business logic (tested)
lib/i18n/, messages/
lib/auth/              session + permissions
```

## 4. Design system

### Tokens
Tokens are Tailwind v4 `@theme` CSS variables in `app/globals.css`, with a `.dark` override.
- **Neutral:** the zinc scale.
  - Page background: `zinc-50` (light) / `zinc-950` (dark).
  - Surface: white / `zinc-900`.
  - Border: `zinc-200` / `zinc-800`.
- **Accent:** `--primary: oklch(0.55 0.2 275)` (indigo-violet). The dark variant is lighter (`oklch(0.68 0.17 275)`).
- **Semantic:**
  - success: emerald
  - warning: amber
  - danger: rose
  - info: sky

  They're used only for status and alerts.
- **Payment chips:** bKash `#E2136E`, Nagad `#F7941D`, Rocket `#8C3494`, Upay `#0B5FA5`.
- **Type:**
  - Base size is 14px. The scale is 12/13/14/16/20/24/30.
  - Numbers use `font-variant-numeric: tabular-nums`.
- **Space, radius, elevation:**
  - spacing on a 4px grid
  - 8px radius for controls, 12px for cards
  - shadows only on popovers, dialogs, and sheets
- **Density:** table rows are 40px, with a compact 32px option. POS touch targets are at least 44px.

### Components
- **Shell:**
  - Sidebar:
    - 240px wide, collapsing to a 64px rail, and a sheet below 1024px.
    - It contains the location switcher, collapsible nav groups, and a pinned "Open POS" button.
  - Header:
    - 56px tall.
    - It contains breadcrumbs, ⌘K search, the calculator, today's profit, notifications, the locale toggle, the theme toggle, and the user menu.
- **Page anatomy:** `PageHeader` (title, description, actions) → an optional KPI row → `FilterBar` (chips) → a `DataTable` card.
- **`DataTable`:**
  - sorting, global search, and pagination (10/25/50/100/All)
  - column visibility, row selection with a bulk-action bar, and a row actions menu
  - sticky header, footer totals, CSV export, print, empty and loading states
  - column prefs saved per `tableId`
- **`FilterBar`:** select, multi-select, date range (presets: Today, Yesterday, Last 7/30 days, This/Last month, This/Last financial year, Custom), and toggle chips. State is synced to URL search params.
- **Forms:**
  - RHF + Zod, with field wrappers that show the label, a required mark, help text, and the error.
  - Inputs: `MoneyInput`, `QtyInput`, `SearchSelect`, `FileDrop`.
  - Long forms use sticky save bars.

## 5. Data layer

### 5.1 Entities
All IDs are strings, and all money is a `number` in major units, rounded by domain helpers.

| Entity | Key fields |
|---|---|
| Business/Settings | Every field in `Product.md` §3.11 Business Settings, grouped by tab |
| Location | id, code (BL0001), name, landmark, address, priceGroupId, invoiceSchemeId, posLayoutId, saleLayoutId, paymentMethods, defaultAccounts, featuredProductIds, active |
| User | id, username, password (mock), name, email, roleId, locationIds, commissionPercent, isSalesAgent, profile fields, bank details |
| Role | id, name, permissions: string[] |
| Contact | id, code, type (supplier/customer/both), businessName, name, mobile, …, customerGroupId, payTerm, creditLimit, openingBalance, assignedTo[], customFields[10], points, active |
| CustomerGroup | id, name, amount, calcType (percentage/selling_price_group), priceGroupId |
| Technician | id, name |
| Product | id, name, sku, barcodeType, unitId, subUnitIds, brandId, categoryId, subCategoryId, locationIds, manageStock, alertQty, description, image, expiry, enableSerial, notForSale, weight, prepTime, taxId, taxType, type (single/variable/combo), warrantyId, rack/row/position, customFields, active |
| Variation | id, productId, name, sku, purchasePriceExc, purchasePriceInc, margin, sellPriceExc, sellPriceInc, groupPrices{groupId: price}, comboItems? |
| Unit | id, name, shortName, allowDecimal, baseUnitId?, multiplier? |
| Category | id, name, code, description, parentId? |
| Brand, Warranty, PriceGroup, VariationTemplate, ExpenseCategory, TaxRate (+ group subTaxIds) | as in `Product.md` |
| StockLot | id, locationId, variationId, sourceTxnId, lotNo, qtyIn, qtyRemaining, unitCost, mfgDate, expDate |
| Transaction | id, type, status, subStatus, locationId, contactId, refNo/invoiceNo, date, lines[], discount, tax, shipping{...}, additionalExpenses[4], totals{...}, payments[], paymentStatus, notes, staffNote, docs, recurring?, parentId?, channel (pos/web), technicianId?, serviceStaffId?, commissionAgentId?, createdBy, createdAt |
| Payment | id, txnId, amount, method, accountId?, details{}, paidOn, note, isReturn (change), refNo |
| Account | id, name, typeId, number, note, openingBalance, status; AccountTransaction ledger |
| Discount | id, name, brandId?, categoryId?, productIds, locationId, priority, type, amount, starts, ends, priceGroups, applyInCustomerGroups, active |
| InvoiceScheme, InvoiceLayout, BarcodeSetting, Printer | as in `Product.md` §3.11 |
| CashRegister | id, userId, locationId, openedAt, closedAt, openingCash, closingNote, status |
| ImportBatch, Notification, Backup | metadata records |

### 5.2 Stores and services
- **Stores:** one `create(persist(...))` store per aggregate, keyed `posible:v1:<name>`. A version bump resets to the seed.
- **Services:** async functions with 0–150ms simulated latency. Reads accept filter objects and return `{ rows, total }`. Writes validate with Zod, run domain logic, and update several stores in one `commit()` helper, so a sale touches transactions, stock, accounts, and contacts together.
- **UI data access:** only through `lib/data/hooks` (TanStack Query). Mutations invalidate the related query keys.

### 5.3 Domain logic (`lib/domain`, pure and unit-tested)
- **`totals`:** line net, tax inclusive or exclusive, line discount (fixed/%), order discount, order tax, shipping, additional expenses, rounding mode (none / whole / 0.05 / 0.1 / 0.5), round-off amount.
- **`pricing`:** default sell price from margin, price-group override, customer-group adjustment.
- **`discounts`:** pick the active rule by date, location, product/brand/category, and the highest priority.
- **`units`:** sub-unit conversion to the base unit.
- **`stock`:** FIFO or LIFO allocation over lots, available qty per location, overselling flag, expiry state.
- **`payments`:** paid total, due, status (paid / partial / due / overdue by pay term), change return.
- **`rewards`:** points earned and redeem value within the configured limits.
- **`commission`:** by invoice value or by payment received.
- **`refs`:** next reference and invoice number from the prefix and scheme.
- **`reports`:** P&L, stock value, register summary, and tax. Selectors are shared by the dashboard and reports.

### 5.4 Seed
Deterministic (seeded random-number generator), with Bangladeshi names and products:
- 2 locations, 8 users, 3 roles (Admin, Manager, Cashier), and ~60 contacts
- ~120 products (electronics, feed, grocery; some variable and some combo products)
- 6 months of history: ~900 sales, ~120 purchases, plus returns, transfers, adjustments, and expenses
- bKash, Nagad, and Cash accounts, and register sessions

"Reset demo data" and JSON export/import live on Settings → Backup.

## 6. Auth and permissions
- Mock login: `admin/112233` (Admin) and `cashier/112233` (Cashier). The session is stored in its own store.
- `can(permission)` gates nav items, buttons, and routes. Routes without permission show a 403 state.

## 7. Errors
- Typed errors: `ValidationError` (field map), `InsufficientStockError`, `CreditLimitError`, `EditWindowExpiredError`, `NotFoundError`.
- Forms map errors to fields, and everything else becomes a sonner toast.
- Each route group has `error.tsx` and `not-found.tsx`.

## 8. Testing
- Vitest covers all of `lib/domain` (TDD) and the service flows (sale, purchase receive, return, transfer, register close) against a fresh seed.
- Playwright smoke test: login → POS split-payment sale → it appears in the sales list → stock goes down → the dashboard total goes up.
- `tsc --noEmit` and ESLint must be clean.

## 9. Acceptance for the Foundation sub-project
- The app boots and login works. The shell renders all nav groups (EN/BN, light/dark).
- ⌘K navigates.
- Every route in §3.3 exists. Routes not yet built render a consistent "Coming in <sub-project>" placeholder inside the shell.
- The seeded data is visible through a sample list (Products) built with `DataTable` + `FilterBar`.
- Domain tests pass.
