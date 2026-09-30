# Sarkar POS — Sales (sub-project 3) design

Covers `Product.md` §3.5 except the POS screen (done). Frontend only, mock data, same data-layer rules as Foundation and POS.

## 1. Scope and rulings
Routes (all exist as placeholders today): `/sales`, `/sales/new`, `/sales/[id]`, `/sales/[id]/edit`, `/sales/drafts`, `/sales/quotations`, `/sales/orders`, `/sales/returns`, `/sales/returns/new`, `/sales/shipments`, `/sales/discounts`, `/sales/import`.

- Ruling: Add Sale reuses the POS `Cart` ops and `cartTotals`, not a second calculator — one set of money maths, already tested. Cost: the form is a cart editor with extra fields, not a bespoke grid.
- Ruling: Drafts and quotations are not separate pages of code. One `SalesList` takes a `kind` (`all | drafts | quotations`) and a column set. Cost: a few columns are hidden per kind.
- Ruling: subscriptions (recurring invoices) are stored on `transaction.recurring` and shown as a badge, but no scheduler runs. Cost: nothing is auto-generated; a "Generate now" row action creates the next invoice.
- Ruling: Import Sales parses CSV in the browser, validates, shows a review table, then commits through `importBatch` (revertable). No XLSX. Cost: CSV only.
- Ruling: "Attach document" and "Shipping documents" store file names only (no bytes). Cost: no download.
- Ruling: Sales orders are created from a minimal form (`/sales/orders` dialog), since Product.md gives no separate create route. Linking orders on Add Sale sets `salesOrderIds` and updates the order's status/remaining qty.

## 2. Data layer
Extend `lib/data/services/sales.ts` (all writes via `commit()`, `await delay()`, `assertCan`):
- `list(filters)` → paged `SaleListRow` (`type: sell`, any status). Filters: location, customer, paymentStatus, date range, createdBy, commissionAgent, shippingStatus, subscription, channel, status. Columns per §3.5: invoice, customer, mobile, location, payment status/method, total, paid, due, return due, shipping status, items, added by, notes.
- `get(id)` → full transaction with joined names (detail page).
- `save(input)` → create or update a sell of any status through the same validation/allocation as `checkout`; editing a final sale first restores its lot allocations, then re-allocates. Adds shipping, additional expenses (≤4), pay term, invoice no. override, sales-order links, recurring.
- `convert(id)` — draft/quotation → final (takes payments if given).
- `addPayment(id, payment)` / `removePayment` — recomputes `paymentStatus`, posts/reverses account txns.
- `setShipping(id, patch)` — status, delivery person, delivered to.
- `ordersService`: `list`, `create`, `remainingQty(order)`.
- `returnsService`: `list`, `create({ parentId, lines:[{lineId, qty}], discount, tax })` restores stock as a new lot at the original cost, refunds or reduces due, sets `returnedQty` on parent lines, writes `sell_return` txn with `parentId`. Returning more than sold throws `ValidationError`.
- `discountsService`: `list/create/update/remove/setActive(ids)`. `lib/domain/discounts.ts` already resolves priority; POS and Add Sale price lookups call it.
- `importService.sales`: `parse(csv)` → `{ rows, errors }`, `commit(rows, fileName)`, `history()`, `revert(batchId)` (deletes created sells and restores stock).
Hooks in `lib/data/hooks/sales.ts`; keys start with `transactions`/`discounts`/`importBatches`.

## 3. UI (`features/sales/`)
- `SalesList` — existing `DataTable` + `FilterBar` + `useUrlFilters`; column menu, CSV export, row actions (View, Edit, Delete, Print, Add payment, View payments, Return, Shipping edit, Convert for drafts/quotations). Footer totals row (total, paid, due).
- `SaleForm` — sections: header (location, customer with points, pay term, date, status, invoice scheme/no., document, link sales orders), product search + lines table (qty, unit price, discount, tax, price inc. tax, subtotal), order discount/tax/redeem/note, shipping block, 4 additional expenses, payment block, subscribe, Save / Save and print. `?status=draft|quotation` presets status. Reuses POS `ProductSearch`/`AddCustomerDialog` where they fit.
- `SaleDetail` — summary, lines, payments table (add/remove), shipping card, activity; Print via the existing `ReceiptModal`/`A4Invoice`.
- `OrdersList`, `ReturnsList`, `ReturnForm` (pick parent sale → qty per line), `ShipmentsList` (inline status/delivery edit dialog), `DiscountsList` + `DiscountDialog` (Brand/Category/Products/Location scope, bulk Deactivate), `ImportSales` (upload → review → import; history with Revert).
- `/sales/[id]/edit` reuses `SaleForm`; this also closes the POS "Edit final sale" placeholder.

## 4. i18n, a11y, permissions
New `sales` namespace as `[en, bn]` pairs in `scripts/messages.mjs`; never hand-edit `messages/*.json`. Routes already carry permissions; services call `assertCan`. Money/dates via `useFormat`. Forms use labelled inputs and inline zod errors.

## 5. Testing
Vitest service tests: list filters, save/edit restores and re-allocates stock, convert, add/remove payment status transitions, return (stock back, parent returnedQty, over-return rejected), orders remaining qty and link, discount priority, import parse errors and revert. Playwright smoke: create a sale, add payment, return part, ship, convert a quotation.

## 6. Acceptance
Every column, filter, field and action in §3.5 (excluding the POS screen) exists and works on mock data, persists across reloads, in EN and BN, light and dark. Typecheck, lint, tests and build are clean.
