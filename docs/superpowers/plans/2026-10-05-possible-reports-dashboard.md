# pos_sible — Reports and Dashboard Implementation Plan (sub-project 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the home dashboard and build all 18 report pages under `/reports/*`.
**Architecture:** A `reportsService` of pure query functions over the DB (one per report, each returning typed rows + totals), a shared `ReportShell` (PageHeader, FilterBar with location/date defaults, print, CSV export, loading/empty states) and small chart wrappers around `recharts` (already installed). Reports are read-only, so no new write paths.
**Branch:** `feat/reports`. Local merge only; no trailer; no push.

## Global Constraints
Same as the Sales plan. Every report filters by location and date range through the same `useUrlFilters` keys (`location`, `range`), prints with the `[data-print-root]` approach, and exports the full filtered set as CSV.

## Review Focus
- Every report total reconciles with the list screens (sales, purchases, expenses) for the same filters; add reconciliation tests.
- Date ranges are inclusive of both days; empty ranges render the empty state, not zeros with broken charts.
- Returns subtract everywhere (profit, purchase & sale, contacts, product sell).
- Profit uses lot cost from allocations, not current purchase price.
- A location filter of "all" never double counts transfers.
- Charts have an accessible text alternative (table or aria-label) and work in dark mode.

## Tasks
### Task 1: Report kit
**Files:** `features/reports/{ReportShell,ReportTable,Charts}.tsx`, `lib/data/services/reports/_shared.ts` (range/location helpers + tests).
### Task 2: Dashboard
Greeting, location selector, date filter, 8 KPI tiles (existing `dashboardService.kpis`), sales-last-30-days chart, top products, stock alerts list, sales due and purchase due tables, expiry alerts (uses `settings.dashboard.expiryAlertDays`). Tests for each new query.
### Task 3: Profit / Loss
Summary (opening/closing stock, purchases, sales, expenses, gross and net profit) plus tabs: products, categories, brands, locations, invoice, date, customer, day. Extend `profitService`.
### Task 4: Purchase & Sale, Tax
Purchase & Sale: purchases block, sales block, overall, due. Tax: input / output / expense tabs with net.
### Task 5: Contacts reports
Customers & Suppliers (per contact totals and dues), Customer Groups (sales per group).
### Task 6: Stock reports
Stock (value by purchase and sale price, potential profit, units sold/transferred/adjusted), Stock Expiry (windows: expired, 1 wk, 15 d, 1 mo, 3 mo, 6 mo, 1 yr; edit/remove expired), Stock Adjustment summary.
### Task 7: Product reports
Trending Products (top-N bar chart), Items (purchase → sale trace), Product Purchase, Product Sell (time range; tabs detailed, detailed with lot, grouped, by category, by brand).
### Task 8: Payment and expense reports
Purchase Payment, Sell Payment (method, group), Expense (per category + chart).
### Task 9: Register and Sales Representative
Register sessions (totals per method incl. bKash/Nagad/Rocket/Upay); Sales Representative (summary, sales added, with commission, expenses, payments with commission using `lib/domain/commission.ts`).
### Task 10: Table report
Total sale per table (shown only when the Tables module is enabled).
### Task 11: Wire-up, smoke, final review
- [ ] Every report reachable from the sidebar and command palette; EN/BN and light/dark pass; full checks, whole-branch review, merge.
