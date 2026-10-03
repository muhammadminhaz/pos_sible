# pos_sible — Expenses and Accounts Implementation Plan (sub-project 6)

**Goal:** Replace every placeholder under `/expenses` and `/accounts`.
**Architecture:** Grow `expensesService` (today only `create`, used by the POS Add Expense dialog) into the full service; add `accountsService` over `accounts`, `accountTxns` and account types. Balance sheet, trial balance and cash flow are pure functions in `lib/domain/ledger.ts`, fed by the service.
**Branch:** `feat/finance`. Local merge only; no trailer; no push.

## Global Constraints
Same as the Sales plan. Expenses keep `type: "expense"`; every payment posts an `accountTxn` (debit for expenses, credit for refunds).

## Review Focus
- Editing an expense's amount or payment re-posts its account transactions (no double counting).
- Refund expenses reverse the sign everywhere (list totals, account balance, register summary).
- Fund transfer writes a debit and a credit sharing `transferPairId`; same-account transfer rejected; overdraft rejected unless the account allows it.
- Closing an account with a non-zero balance is rejected; closed accounts can't be posted to.
- Recurring expenses never generate more than `repetitions` copies.
- Balance sheet balances (assets = liabilities + equity) on the seeded data for any date and location.
- Deleting a category used by expenses is rejected; sub-categories follow their parent.

## Tasks
### Task 1: expensesService — list, get, save, remove, recurring
**Interfaces:** `list(f)` (category, sub-category, date range, payment status, location, contact, user), `get`, `save(input)` (location, category, sub-category, ref no, date, for-user, for-contact, tax, amount, note, isRefund, recurring, payments), `remove`, `addPayment/removePayment`, `generateNext(id)`.
- [ ] Tests first for every Review Focus item above.
### Task 2: Expense categories
Categories + sub-categories (name, code) through `CrudPage` with a parent selector.
### Task 3: Expenses list and form
Filters per inventory; columns (recurring details, category, sub-category, location, payment status, tax, total, due, for user, contact, note, added by); add/edit form with document name, tax, refund and recurring switches, payment block; payment dialog.
### Task 4: accountsService
**Interfaces:** `types` (crud with sub-types), `list({ status })` with balances, `get`, `save`, `close/reopen`, `book(id, range)` (running balance), `transfer({ from, to, amount, note, date })`, `deposit({ accountId, fromAccountId, amount, note })`.
- [ ] Tests first: balance = opening + credits − debits; transfer pairs; close rules; book running balance.
### Task 5: Accounts list, account book, transfer/deposit dialogs
Tabs Accounts | Account Types; status filter; columns (name, type, sub type, number, note, balance, details, added by); row actions (edit, book, transfer, deposit, close).
### Task 6: Ledger reports — balance sheet, trial balance, cash flow
**Files:** `lib/domain/ledger.ts` (+ tests), `features/accounts/{BalanceSheet,TrialBalance,CashFlow}.tsx`. Filters: location and date (cash flow adds account and debit/credit). Printable.
- [ ] Tests: balance sheet balances on the seed; trial balance debits = credits.
### Task 7: Payment account report
Payments ↔ accounts table (date, payment ref, invoice/ref no., amount, type, account, description) with a "Link account" action that assigns an account to a payment and posts the account transaction.
### Task 8: Wire-up, smoke, final review
- [ ] POS Add Expense uses the new service; register summary still reconciles. Full checks, whole-branch review, merge.
