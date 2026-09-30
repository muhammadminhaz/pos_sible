# pos_sible — Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace every `/sales/*` placeholder with a working screen on mock data.
**Architecture:** Extend `salesService` and add `returnsService`, `ordersService`, `discountsService`, `salesImportService`. UI in `features/sales/`, built on the shared `DataTable`/`FilterBar`/`PageHeader`. Add Sale is a cart editor that reuses `lib/pos/cart.ts` and `cartTotals`.
**Tech Stack:** Next.js 16, React 19 (React Compiler lint rules), TanStack Query, next-intl, zod 3, vitest.
**Spec:** `docs/superpowers/specs/2026-10-01-possible-sales-design.md`

## Progress
Tasks 1–8 are done (services, tests, hooks, messages; extras: `generateNext`, `discount.manage` permission, CSV reader `lib/csv.ts`). Task 9 is done (All Sales, Drafts, Quotations, payments and shipping dialogs). Tasks 10–13 remain.

## Global Constraints
- DB writes only through `commit()`; services start with `await delay()`, call `assertCan(...)`, throw `AppError` subclasses; UI never imports `getDB`.
- Query keys start with the table name (`transactions`, `discounts`, `importBatches`).
- Messages only via `node scripts/messages.mjs messages`; every key is an `[en, bn]` pair. Never hand-edit `messages/*.json`.
- Money through `useFormat`/`roundMoney`. Title Case labels. No setState in `useEffect`; no variable mutation during render.
- Commits as repo user, **no `Co-Authored-By` trailer**. Do not push.
- Before each task: `npx vitest run`, `npx tsc --noEmit`, `npm run lint` must be clean at commit.

## Review Focus
- Editing a final sale must restore old lot quantities before re-allocating (stock must not drift on repeated saves).
- Deleting/reverting a final sale or import restores stock and account txns.
- Return qty > sold qty (including prior returns) is rejected; returning 0 lines is rejected.
- Overpaying a sale, or adding a payment to a draft/quotation, is rejected.
- Convert of a quotation with insufficient stock fails without partial writes.
- Filters with no matching rows show the empty state; page resets to 0 on filter change.
- Walk-in customer cannot have a due balance on Save (same rule as POS).
- Discount with `endsAt < startsAt` rejected; expired/inactive rules are not applied.
- Import with a bad row reports the row number and imports nothing.

## File map
- Modify `lib/data/services/sales.ts` (+ `sales.test.ts`): list/get/save/convert/payments/shipping/remove-final.
- Create `lib/data/services/{returns,orders,discounts,salesImport}.ts` with tests.
- Create `lib/data/hooks/sales.ts`.
- Create `features/sales/{SalesList,columns,filters,SaleForm,SaleDetail,PaymentsDialog,ShippingDialog,OrdersList,ReturnsList,ReturnForm,ShipmentsList,DiscountsList,DiscountDialog,ImportSales}.tsx`.
- Modify `app/(app)/sales/**/page.tsx` (12 pages), `scripts/messages.mjs` (`sales` namespace), `lib/routes.ts` only if a title is missing.

---

### Task 1: List and detail queries
**Files:** Modify `lib/data/services/sales.ts`, `sales.test.ts`.
**Interfaces — Produces:**
```ts
export type SaleFilters = ListQuery & { kind?: "all"|"drafts"|"quotations"; locationId?: string; contactId?: string;
  paymentStatus?: PaymentStatus; from?: string; to?: string; createdBy?: string; agentId?: string;
  shippingStatus?: ShippingStatus; subscription?: boolean; channel?: "pos"|"web"; };
export type SaleListRow = { id; refNo; date; status; contactName; mobile; locationName; paymentStatus; methods: PaymentMethod[];
  total; paid; due; returnDue; shippingStatus: ShippingStatus|null; itemsCount; addedBy; note; staffNote; recurring: boolean; channel };
salesService.listAll(f: SaleFilters): Promise<ListResult<SaleListRow> & { totals: { total:number; paid:number; due:number } }>
salesService.get(id): Promise<Transaction & { contactName; locationName; addedBy; lineNames: Record<string,string> }>
```
- [ ] Write failing tests: each filter narrows results; `kind:"drafts"` returns only drafts; `totals` equals the sum over all filtered rows (not just the page); `returnDue` = parent total − returns refunded; unknown id → `NotFoundError`.
- [ ] Run `npx vitest run lib/data/services/sales.test.ts` — FAIL.
- [ ] Implement using `matches`, `sortRows`, `paginate`, `paymentSummary`; search over refNo, contact name, mobile.
- [ ] Run tests — PASS. Commit `feat(sales): list and detail queries`.

### Task 2: Save (create/edit), convert, delete
**Files:** Modify `sales.ts`, `sales.test.ts`.
**Interfaces — Produces:**
```ts
export type SaleInput = CheckoutInput & { id?: string; refNo?: string; payTerm?: PayTerm|null; shipping?: Partial<Transaction["shipping"]>;
  additionalExpenses?: {name:string;amount:number}[]; salesOrderIds?: string[]; recurring?: Transaction["recurring"]; commissionAgentId?: string|null;
  documents?: string[]; invoiceSchemeId?: string|null; status: SaleStatus|"proforma" };
salesService.save(input: SaleInput): Promise<CheckoutResult>
salesService.convert(id: string, payments?: CheckoutPayment[]): Promise<CheckoutResult>
salesService.removeAny(id: string): Promise<void>   // final too; restores lots + reverses account txns + points
```
Refactor: extract the body of `checkout` into an internal `writeSale(d, input)`; `checkout` calls it; `save` with `id` first calls `revertSale(d, id)` (restore `stockLots.qtyRemaining` from `line.allocations`, delete its accountTxns, refund points) then `writeSale` keeping the same `refNo`/`createdAt`.
- [ ] Tests: edit final sale twice → stock equals original minus qty (no drift); edit changes total and payment status; `additionalExpenses` added to total; 5 additional expenses rejected; manual `refNo` duplicate rejected (`AppError "duplicate_ref"`); convert quotation → final consumes stock and gets an invoice no.; convert with short stock throws `InsufficientStockError` and leaves the DB unchanged; `removeAny` on final restores stock and removes account txns; all require the matching permission.
- [ ] Run — FAIL. Implement. Run — PASS. `npx tsc --noEmit`. Commit `feat(sales): save, convert, delete`.

### Task 3: Payments and shipping mutations
**Files:** Modify `sales.ts`, `sales.test.ts`.
```ts
salesService.addPayment(id, p: CheckoutPayment & { paidOn?: string }): Promise<void>   // sell.payments
salesService.removePayment(id, paymentId): Promise<void>
salesService.setShipping(id, patch: Partial<Pick<Transaction["shipping"],"status"|"deliveredTo"|"deliveryPersonId"|"details"|"address"|"charges">>): Promise<void>
```
- [ ] Tests: partial then full payment moves `due → partial → paid`; overpay rejected (`ValidationError`); payment on a draft rejected; removing a payment reverses its account txn and status; `setShipping` status transitions persist.
- [ ] Implement, pass, commit `feat(sales): payments and shipping`.

### Task 4: Sell returns service
**Files:** Create `lib/data/services/returns.ts`, `returns.test.ts`.
```ts
returnsService.list(f: ListQuery & {locationId?; contactId?; from?; to?; createdBy?}): Promise<ListResult<ReturnRow>>
returnsService.parentLines(saleId): Promise<{ lineId; name; soldQty; returnedQty; unitPrice }[]>
returnsService.create(i: { parentId: string; lines: {lineId:string; qty:number}[]; discount?: DiscountInput|null; note?: string; refundMethod?: PaymentMethod }): Promise<{ id: string; total: number }>
returnsService.remove(id)   // restores returnedQty, removes the created lot
```
Return writes a `sell_return` txn (`parentId`), a new `StockLot` per managed line at the line's `unitCost`, increments parent `lines[].returnedQty`, and posts a refund `accountTxn` (debit) when the parent was paid.
- [ ] Tests: partial return updates `returnedQty` and stock; second return that would exceed sold throws `ValidationError`; empty lines rejected; return of a due sale reduces due instead of refunding; `remove` undoes everything.
- [ ] Implement, pass, commit `feat(sales): sell returns service`.

### Task 5: Sales orders service
**Files:** Create `orders.ts`, `orders.test.ts`.
```ts
ordersService.list(f: ListQuery & {locationId?; contactId?; status?: "ordered"|"partial"|"completed"; shippingStatus?; from?; to?}): Promise<ListResult<OrderRow>>  // OrderRow has remainingQty
ordersService.create(i: { locationId; contactId; date; lines: {productId;variationId;unitId;qty;unitPrice}[]; note? }): Promise<{id:string;refNo:string}>
ordersService.openFor(contactId): Promise<OrderRow[]>
```
`writeSale` (Task 2) with `salesOrderIds` sets each line's `parentLineId`, then recomputes order status (`ordered` / `partial` / `completed`) from fulfilled qty.
- [ ] Tests: `remainingQty` math; linking a sale that covers half the order → `partial`; covering all → `completed`; deleting that sale reverts the status.
- [ ] Implement, pass, commit `feat(sales): sales orders service`.

### Task 6: Discounts service
**Files:** Create `discounts.ts`, `discounts.test.ts`.
```ts
discountsService.list(f: ListQuery & {active?: boolean; locationId?}): Promise<ListResult<DiscountRow>>
discountsService.save(d: Omit<Discount,"id"|"createdAt"|"createdBy"|"updatedAt"> & {id?: string}): Promise<string>
discountsService.setActive(ids: string[], active: boolean): Promise<void>
discountsService.remove(ids: string[]): Promise<void>
```
- [ ] Tests: `endsAt < startsAt` → `ValidationError`; `setActive` bulk; list filter `active`; a saved rule is returned by `lib/domain/discounts.findDiscount` for a matching product.
- [ ] Implement, pass, commit `feat(sales): discounts service`.

### Task 7: Sales import service
**Files:** Create `salesImport.ts`, `salesImport.test.ts`.
```ts
salesImportService.parse(csv: string): { rows: ImportRow[]; errors: { row: number; message: string }[] }
salesImportService.commit(rows: ImportRow[], fileName: string): Promise<{ batchId: string; created: number }>
salesImportService.history(): Promise<ImportBatch[]>
salesImportService.revert(batchId: string): Promise<void>
```
CSV columns: `date,customer_mobile,location,sku,qty,unit_price,payment_method,paid`. Rows with the same `invoice_group` (optional column) merge into one sale; otherwise each row is one sale. Uses `writeSale`; stores `importBatchId` on each created sell and `recordIds` on the batch.
- [ ] Tests: good CSV creates sells; bad SKU reports `row N` and commits nothing; revert removes the sells and restores stock.
- [ ] Implement, pass, commit `feat(sales): import service`.

### Task 8: Hooks and messages
**Files:** Create `lib/data/hooks/sales.ts`; modify `scripts/messages.mjs`.
Hooks: `useSalesList(f)`, `useSale(id)`, `useSaleMutations()` (`save, convert, remove, addPayment, removePayment, setShipping`), plus list/mutation hooks for returns, orders, discounts, import. Mutations invalidate `["transactions"]` and `["products"]` (stock) and `["contacts"]` (points/due).
- [ ] Add the `sales` namespace: page titles, every column header and filter label from spec §3, statuses, form labels, toasts, errors. Run `node scripts/messages.mjs messages`; run the i18n parity test.
- [ ] Commit `feat(sales): hooks and messages`.

### Task 9: SalesList (All sales, Drafts, Quotations)
**Files:** Create `features/sales/{SalesList,columns,filters}.tsx`, `PaymentsDialog.tsx`, `ShippingDialog.tsx`; modify `app/(app)/sales/page.tsx`, `drafts/page.tsx`, `quotations/page.tsx`.
Follow `features/products/ProductsList.tsx` (URL filters via `useUrlFilters`, `useTableQuery("sales")`, CSV export, column menu). Footer shows total/paid/due from the query. Row actions per spec §3, each gated with `useCan`. `?channel=pos` makes the list the "List POS" view.
- [ ] Build; verify in the browser at 1280px in EN and BN, light and dark (delete `.playwright-mcp/` afterwards). Lint + tsc clean.
- [ ] Commit `feat(sales): sales lists`.

### Task 10: SaleForm (new and edit) and SaleDetail
**Files:** Create `features/sales/{SaleForm,SaleDetail}.tsx`; modify `sales/new`, `sales/[id]`, `sales/[id]/edit` pages.
Form state is a local `Cart` plus a `meta` object; totals from `cartTotals`. `?status=` presets status. Save and Save-and-print (opens `ReceiptModal` via `usePosDialogs`). Edit loads through a new `salesService.toForm(id)` (a superset of `toCart`, allowed for final sales). Detail page shows lines, payments (with `PaymentsDialog`), shipping card, print.
- [ ] Build; browser-check create, edit final (stock unchanged after save with no edits), draft → convert. Commit `feat(sales): add/edit sale and detail`.

### Task 11: Orders, Returns, Shipments
**Files:** Create `features/sales/{OrdersList,ReturnsList,ReturnForm,ShipmentsList}.tsx`; modify the four page files (`orders`, `returns`, `returns/new`, `shipments`).
- [ ] Build; browser-check a partial return (parent line shows returned qty) and a shipment status change. Commit `feat(sales): orders, returns, shipments`.

### Task 12: Discounts and Import
**Files:** Create `features/sales/{DiscountsList,DiscountDialog,ImportSales}.tsx`; modify `discounts`, `import` pages.
- [ ] Build; browser-check bulk Deactivate and an import with one bad row then a good file, then Revert. Commit `feat(sales): discounts and import`.

### Task 13: Wire-up, smoke test, final review
- [ ] Point the POS "Edit final sale" action and Recent drawer at `/sales/[id]/edit`; remove the placeholder handling.
- [ ] Run the spec §5 Playwright smoke path by hand through the browser tools. Run `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] Whole-branch review; fix; merge to main with `git merge --no-ff feat/sales`; delete the branch. Do not push.
