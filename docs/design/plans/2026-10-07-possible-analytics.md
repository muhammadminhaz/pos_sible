# pos_sible — Analytics Tab Implementation Plan (sub-project 9)

**Goal:** A top-level **Analytics** tab (`/analytics`) that gathers every useful business insight in one place: sales, profit, products, inventory, customers, suppliers, staff, payments, expenses, cash flow and forecasts. Each insight gets the chart type that suits it best.
**Architecture:** An `analyticsService` (`web/lib/data/services/analytics/*`) of pure, typed query functions over the same store and services the reports use (`sales`, `returns`, `purchases`, `expenses`, `_stock`, `_ledger`, `registers`, `contacts`, `ledgerReports`, `reports/*`). It runs in the browser for demo mode and on the server for API mode, the same as the other services. The UI lives in `web/features/analytics/*`. It reuses `ReportShell` filters, `print.tsx` and CSV export from `features/reports`, and adds a chart kit built on `recharts` (already installed). This is read-only: no new tables and no write paths.

## Global Constraints
- Every widget uses the shared URL filters: `location` (or all), `range` (preset or custom) and `compare` (previous period / same period last year / none). Date ranges include both end dates.
- Returns are subtracted everywhere. Profit uses lot cost from allocations, never the current purchase price. Transfers are never double counted when the location is "all".
- Money is formatted with `lib/domain/money.ts`. All labels come from i18n (EN + BN). Every chart works in both light and dark mode.
- Every chart has an accessible fallback: an `aria-label` summary and a "View as table" toggle that also exports CSV.
- Permissions: new `analytics.view`. Profit and margin widgets also need `report.profit_loss`. Staff widgets need `user.view`.
- Performance: one aggregated query per widget, memoized by `(location, range, compare)` with React Query. Heavy aggregations (cohorts, RFM, basket) run in a web worker in demo mode. In API mode they use SQL `GROUP BY`. Target under 300 ms per widget on the seed data.
- Empty ranges show the empty state, never charts full of zeros.

## Chart Kit (Task 1)
`features/analytics/charts/`: thin, themed recharts wrappers with tooltip, legend, a11y table fallback and a loading skeleton.

| Component | Use |
|---|---|
| `KpiTile` (value, delta vs compare, sparkline) | headline metrics |
| `LineTrend` / `AreaTrend` (with compare overlay) | time series |
| `StackedBar` / `GroupedBar` / `HorizontalBar` | breakdowns, rankings |
| `ComboBarLine` (dual axis) | revenue vs margin %, units vs price |
| `Donut` (max 6 slices + "Other") | share of total |
| `Treemap` | category → product hierarchy |
| `Heatmap` (custom SVG grid) | hour × weekday, cohort retention |
| `Scatter` / `Bubble` | product matrix, customer RFM |
| `Funnel` | quotation → order → sale → paid |
| `Waterfall` (stacked bar trick) | revenue → net profit bridge |
| `Gauge` / `RadialBar` | targets, stock health |
| `ParetoChart` (bar + cumulative line) | ABC / 80-20 |
| `CalendarHeatmap` | daily sales across the year |
| `Sankey` (recharts `Sankey`) | cash in → accounts → cash out |

## Page Layout
`/analytics` has a sticky filter bar and a tab strip. Each section is its own sub-route (`/analytics/sales`, `/analytics/products`, …) so it can be deep-linked and lazy-loaded. Charts sit in a 12-column responsive grid. Each card has a title, an info tooltip that defines the metric, a ⋯ menu (view table, CSV, PNG, fullscreen) and a drill-down link to the matching report or list.

## Insight Catalog (what each section shows)

### 1. Overview (`/analytics`)
- KPI tiles: Net Sales, Gross Profit, Net Profit, Gross Margin %, Orders, Avg Order Value, Items per Sale, Customers (new / returning), Purchases, Expenses, Stock Value, Receivables Due, Payables Due, Cash on Hand. Each shows a delta and a sparkline.
- Revenue vs profit trend, with comparison: **ComboBarLine**
- Profit bridge (Sales − Returns − Discounts − COGS − Expenses − Tax = Net): **Waterfall**
- Daily sales across the year: **CalendarHeatmap**
- Auto-generated "Insights" list of plain-language callouts (e.g. "Sales down 18% vs last week, driven by Category X"), built from rule-based anomaly checks (z-score against a 4-week baseline).

### 2. Sales
- Sales over time (day/week/month granularity toggle): **AreaTrend** with comparison overlay
- Sales by hour × weekday (busiest times, for staffing): **Heatmap**
- Sales by location, channel (POS / invoice / order) and payment status: **StackedBar**
- AOV and basket size trend: **LineTrend**
- Discounts given and discount % of sales: **ComboBarLine**
- Returns rate and return reasons: **Donut** + trend line
- Sales pipeline (quotation → order → sale → fully paid), with conversion %: **Funnel**
- Shipping status breakdown and average time to deliver: **HorizontalBar**
- Sales tax collected over time: **GroupedBar**

### 3. Products & Categories
- Top / bottom N products by revenue, units and profit (switchable): **HorizontalBar**
- Revenue share by category → brand → product: **Treemap**
- ABC analysis (A = top 80% of revenue): **ParetoChart** + class table
- Product matrix of sales velocity vs margin (stars, cash cows, question marks, dogs): **Bubble** (size = revenue)
- Price vs units sold by variation: **Scatter**
- Frequently bought together (top item pairs with support / confidence / lift): table + **HorizontalBar**
- Trending up / down (week-over-week growth): ranked lists with sparklines
- Dead stock (no sales in N days): table with value at cost

### 4. Inventory
- Stock value over time (at cost and at sale price): **AreaTrend**
- Stock health (in stock / low / out / overstock): **Donut** + **Gauge**
- Inventory turnover and days of inventory by category: **GroupedBar**
- Sell-through rate by product and category: **HorizontalBar**
- Days of stock left (current stock ÷ average daily units) with reorder suggestions: table, sorted by urgency
- Expiry exposure (expired, 7 d, 30 d, 90 d), value at risk: **StackedBar**
- Shrinkage from adjustments (damage, loss, theft), by reason: **Donut** + trend
- Transfers between locations: **Sankey**

### 5. Customers
- New vs returning customers over time: **StackedBar**
- Cohort retention (first-purchase month × months since): **Heatmap**
- RFM segments (Champions, Loyal, At Risk, Lost, …): **Bubble** + segment counts **Donut**
- Customer lifetime value distribution: histogram (**GroupedBar**)
- Top customers by revenue and profit: **HorizontalBar**
- Purchase frequency and average days between visits: **LineTrend**
- Sales by customer group: **Donut**
- Receivables aging (current, 1–30, 31–60, 61–90, 90+): **StackedBar**
- Reward points issued vs redeemed: **ComboBarLine**
- Churn risk list (past their usual interval with no visit): table

### 6. Suppliers & Purchasing
- Purchase spend over time, by supplier: **StackedBar**
- Supplier share of spend: **Donut**
- Purchase price trend per product (cost inflation alerts): **LineTrend**
- Payables aging: **StackedBar**
- Purchase returns rate by supplier: **HorizontalBar**
- Lead time (order → received), when the dates exist: **GroupedBar**

### 7. Staff & Registers
- Sales and profit per sales rep / cashier: **GroupedBar**
- Commission earned: **HorizontalBar**
- Sales rep vs target: **RadialBar**
- Register sessions: cash over / short per session: **LineTrend** + table
- Average transaction time and voids or discounts per cashier (fraud signals): table + **Scatter**

### 8. Payments & Cash Flow
- Payment method mix (Cash, Card, bKash, Nagad, Rocket, Upay, …) over time: **StackedBar** + **Donut**
- Cash flow in vs out, with net line: **ComboBarLine**
- Money flow from income sources → accounts → expense categories / suppliers: **Sankey**
- Account balances over time: **LineTrend**
- Collection efficiency (days sales outstanding): **KpiTile** + trend

### 9. Expenses & Profitability
- Expenses by category over time: **StackedBar**
- Expense share: **Treemap**
- Expense ratio (expenses ÷ sales): **LineTrend**
- Profit / margin by location, category, brand and customer group: **GroupedBar**
- Break-even point (fixed expenses ÷ contribution margin %), against actual sales: **LineTrend** with reference line
- Profit per day of week: **GroupedBar**

### 10. Forecasts & Goals
- Next 30 / 90 day sales forecast (Holt-Winters / seasonal moving average in `lib/domain/forecast.ts`) with confidence band: **AreaTrend**
- Stock-out forecast per product (date it hits zero): table + timeline
- Monthly targets (sales, profit, new customers) set in Settings → Analytics, and progress: **Gauge**
- Seasonality index by month: **GroupedBar**

## Tasks
### Task 1: Chart kit
`features/analytics/charts/*` as above, plus storybook-style demo route `/analytics/_kit` (dev only). Tests: a11y table fallback renders the same numbers; dark-mode tokens apply.
### Task 2: Analytics shell and routing
`app/(app)/analytics/layout.tsx` (filter bar + tabs) and one `page.tsx` per section. Add a nav entry in `lib/nav.ts` (icon `LineChartIcon`, before Reports), routes in `lib/routes.ts`, a command palette entry, the `analytics.view` permission (roles + `lib/server` RBAC), and i18n keys (EN/BN). Update `nav.test.ts` / `routes.test.ts`.
### Task 3: Shared analytics domain helpers
`lib/domain/analytics/{period,compare,bucket,stats,rfm,abc,cohort,basket,forecast}.ts`. These are pure functions with unit tests: period bucketing (day/week/month, locale week start), comparison ranges, z-score anomalies, percentiles, RFM scoring (quintiles), ABC classification, cohort matrix, pair counting with lift, and Holt-Winters.
### Task 4: `analyticsService`
`lib/data/services/analytics/{overview,sales,products,inventory,customers,suppliers,staff,cash,expenses,forecast}.ts`. Each widget gets a typed function `(ctx, filters) => { rows, totals }`. They are exposed through RPC in API mode (`api/lib/server/rpc.ts`), with SQL aggregation in API mode. Reconciliation tests check that the totals match `reports/*` and the list screens for the same filters.
### Task 5: Overview page + insight engine
KPI grid, waterfall, calendar heatmap. `insights.ts` rules produce ranked, translated callouts that link to the drill-downs.
### Task 6: Sales page
### Task 7: Products & Categories page (ABC, matrix, basket analysis)
### Task 8: Inventory page (turnover, days of stock, expiry, shrinkage, transfers Sankey)
### Task 9: Customers page (cohorts, RFM, CLV, aging, churn list)
### Task 10: Suppliers & Purchasing page
### Task 11: Staff & Registers page
### Task 12: Payments & Cash Flow page
### Task 13: Expenses & Profitability page (break-even)
### Task 14: Forecasts & Goals page + Settings → Analytics (targets, low-stock threshold days, dead-stock days, fiscal week start)
### Task 15: Polish
Card ⋯ menu (table / CSV / PNG via `html-to-image` / fullscreen), drill-down links, saved views (pinned widgets per user, stored in settings), print layout, mobile layout (cards stack, charts scroll horizontally only inside the card).
### Task 16: Verification
- [ ] Every widget matches the corresponding report total on seed data (reconciliation tests)
- [ ] EN/BN, light/dark and mobile pass; keyboard navigation and screen-reader labels pass
- [ ] Demo mode and API mode both render every widget; performance budget met
- [ ] Update README status table and `Product.md`

## Review Focus
- No double counting (transfers, partial returns, split payments).
- Comparison periods have equal length and align on weekday when the granularity is weekly.
- Forecasts and insights are labelled as estimates and never shown with fewer than 8 weeks of history.
- Charts never show more than ~7 colors. Long tails are grouped into "Other".
