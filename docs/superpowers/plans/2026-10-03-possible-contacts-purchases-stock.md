# pos_sible — Contacts, Purchases and Stock Implementation Plan (sub-project 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace every placeholder under `/contacts`, `/purchases` and `/stock`.
**Architecture:** Extend `contactsService`; add `purchasesService`, `purchaseReturnsService`, `transfersService`, `adjustmentsService` (all writing stock through lots, FIFO/LIFO via `lib/domain/stock.ts`). Reuse `DataTable`/`FilterBar`, the Sales payment dialog pattern and the `ImportWizard` from Catalog.
**Branch:** `feat/operations`. Local merge only; no trailer; no push.

## Global Constraints
Same as the Sales plan (commit-only writes, `assertCan`, messages via the generator, `useFormat`, React Compiler rules, all checks clean before each commit).

## Review Focus
- Receiving a purchase creates lots at the line's unit cost; editing a received purchase never goes below stock already sold from its lots.
- Deleting a purchase whose stock was sold is rejected.
- Purchase return qty cannot exceed what is still in the lots.
- Transfer: stock leaves the source on "In transit" and arrives on "Completed"; source = destination rejected; cancelling reverses.
- Adjustment cannot remove more than available (unless overselling allowed); abnormal adjustments record recovered amount.
- Contact delete blocked when transactions exist; duplicate mobile rejected; credit limit and opening balance feed due totals.
- Paying contact dues allocates oldest invoices first and never overpays.

## Tasks
### Task 1: contactsService — full CRUD, dues, payments
**Interfaces:** `contactsService.create/update/remove`, `.ledger(id)` (invoices, payments, returns, running balance), `.payDue(id, { amount, method, accountId, note })` (FIFO over unpaid invoices/purchases), `.customerGroups` via `crud`, `.technicians` via `crud`.
- [ ] Tests first for each rule in Review Focus; `contacts.customer` / `contacts.supplier` permissions.
### Task 2: Customers and Suppliers lists
Filters: purchase due / sell due, purchase return / sell return, advance balance, opening balance, "no sell in 1/3/6/12 months", customer group, assigned to, status. Supplier and customer column sets (incl. credit limit, points, group, custom fields). Row actions: view, edit, deactivate, pay due, delete.
### Task 3: Contact form + detail
Type (supplier/customer/both), individual vs business, group, name, mobile, alternate, email, DOB, source, life stage, assigned users, tax no., opening balance, pay term, credit limit, address, shipping address, custom fields 1–10. Detail page: summary cards, ledger, payments, documents, reward points.
### Task 4: Customer groups, Technicians, Import contacts
Customer groups (name, discount %, price group) and technicians as `CrudPage` configs; import via `ImportWizard`.
### Task 5: purchasesService — list/get/save/status/payments/delete
**Interfaces:** `list(f)`, `get(id)`, `save(input)`, `setStatus(id, status)`, `addPayment/removePayment`, `remove(id)`; line fields: qty, unit cost, discount %, tax, lot no., mfg/exp, profit margin %, sell price inc tax (updates the variation price when enabled); footer: discount, tax, shipping, up to 4 additional expenses; currency exchange rate.
- [ ] Tests first: received creates lots; pending/ordered don't; status → received creates lots exactly once; edit adjusts lots; delete blocked when sold; payment status transitions; new purchase sets variation price when "update price from purchase" is on.
### Task 6: Purchases list + Add/Edit purchase + detail
Filters: location, supplier, purchase status, payment status, date. Columns per inventory. Update-status dialog, payment dialog (reuse Sales `PaymentsDialog` via a shared `TxnPaymentsDialog`), Print. Form with inline add-supplier.
### Task 7: Purchase returns
`purchaseReturnsService.list/create/remove` against a parent purchase (lots reduced; refund or credit). List (location, date) + create form.
### Task 8: transfersService + Stock Transfers UI
`list/create/updateStatus/remove`; statuses Pending → In transit → Completed; shipping charges, notes. List, create form (product search + lines), detail with status stepper.
### Task 9: adjustmentsService + Stock Adjustments UI
`list/create/remove`; type normal/abnormal, total recovered, reason; list + create form.
### Task 10: Wire-up, smoke, final review
- [ ] Purchase → stock appears in POS; transfer moves stock between locations; adjustment reduces stock; supplier due reflects payment. Full checks, whole-branch review, merge.
