# pos_sible — POS Screen Design (sub-project 2)

- **Requirements:** the POS screen, cash register, bKash/Nagad buttons, shipping zones and technicians
- **Builds on:** the foundation (`docs/design/specs/2026-09-27-possible-foundation-design.md`)
- **Route:** `/pos` in the `(pos)` group: full screen, auth guard, permission `pos.access`

## 1. Goals and decisions

- **Desktop cashier first.** Mouse, keyboard, and a USB barcode scanner (keyboard wedge). The layout is split: cart on the left, grid on the right. Touch still works (targets ≥ 44px), but tablets aren't the design target. Minimum supported width is 1024px; below it, a notice asks for a wider screen.
- **After payment:** a receipt preview modal (80mm thermal layout) with Print, **New sale (Enter)**, and **A4 invoice**. The cart is already cleared behind the modal.
- **Register gate:** the POS is locked until the user opens a cash register at the current location.
- **Cart state:** a Zustand store persisted per location. Mutations are pure, unit-tested functions. Totals are always derived, never stored.
- **Settings:** every `settings.pos.*` toggle is honoured, along with the payment-method list of the current location.
- **Out of scope:** Add Sale, the sales and drafts lists, sell returns. Those belong to sub-project 3; the POS links to their routes.

## 2. Architecture

```
lib/pos/
  cart.ts            CartState type + pure ops + useCart store (persist key posible:v1:cart:<locationId>)
  cart.test.ts
  selectors.ts       cartTotals(cart, ctx), paymentState(payable, payments)
  selectors.test.ts
  scale.ts           parseScaleBarcode(code, settings) → { sku, qty } | null
  scale.test.ts
  shortcuts.ts       useHotkeys(map) + parse "shift+f2"-style strings from settings
lib/data/services/
  sales.ts           checkout, recent, suspended, resume, remove, get
  sales.test.ts
  registers.ts       current, open, summary, close
  registers.test.ts
lib/data/hooks/
  sales.ts, registers.ts
features/pos/
  PosScreen.tsx      layout + register gate
  TopBar.tsx
  cart/              CustomerPicker, ProductSearch, CartTable, CartRow, CartTotals
  grid/              ProductGrid, ProductCard, GridFilters
  ActionBar.tsx
  dialogs/           Payment, Discount, OrderTax, Shipping, RedeemPoints, AddCustomer,
                     AddExpense, Suspended, Recent, RegisterOpen, RegisterClose,
                     RegisterDetails, WeighingScale, Shortcuts
  receipt/           ReceiptModal, ThermalReceipt, A4Invoice
app/(pos)/pos/page.tsx
```

### 2.1 Cart (`lib/pos/cart.ts`)

`CartState`:
- `lines: CartLine[]`: `{ key, productId, variationId, name, sku, unitId, unitName, qty, unitPrice (as sold, per product taxType), taxId, taxRate, taxType, discount, note, serials[], serviceStaffId, enableSerial, maxQty (stock, null when not managed) }`
- `contactId` (default `walk-in`), `discount`, `orderTaxId`/`orderTaxRate`, `shipping { zone, charges, details, address }`, `technicianId`, `invoiceLayoutId`, `date` (null = now), `pointsRedeemed`, `resumedFromId` (null)

Pure ops (each `(state, …args) → state`):
- `addItem(product, variation, qty=1, price)`: a repeat scan of the same variation adds to the qty of its existing line
- `setQty`, `setPrice`, `setLineDiscount`, `setLineNote`, `setSerials`, `removeLine`
- `setContact`, `setDiscount`, `setOrderTax`, `setShipping`, `setTechnician`, `setLayout`, `setDate`, `redeemPoints`
- `load(txn)` for resume/edit, and `clear()`

The store wraps the ops and keys persistence by location. Switching location swaps to that location's cart.

### 2.2 Selectors (`lib/pos/selectors.ts`)

- `cartTotals(cart, { rounding, rewardSettings })` maps the lines to `orderTotals` (existing domain code). It returns `{ lines: LineTotals[], itemsCount, linesTotal, discount, orderTax, shipping, redeemed, roundOff, total }`.
- `paymentState(payable, payments[])` returns `{ paid, change, shortfall }`. Change counts only cash overpayment. Non-cash overpayment is an error.

### 2.3 Sales service (`lib/data/services/sales.ts`)

`checkout({ cart, payments, status, locationId, userId })`, all inside one `commit`:
1. Validate:
   - There must be at least one line.
   - `status === "final"` with shortfall > 0 requires a non walk-in customer and a balance within `creditLimit`. Otherwise it throws `CreditLimitError` or `AppError("walk_in_credit")`.
   - Any serial-enabled line needs as many serials as its qty.
2. For `final`: `allocate` FIFO from the lots at the location. A shortfall throws `InsufficientStockError`. Write `lot.qtyRemaining`, `line.allocations`, and `line.unitCost`.
3. Reference: `final` uses `nextInvoiceNo` from the location's invoice scheme (then `count += 1`). Draft, quotation, and suspended use `takeRef(draft, settings.prefixes.draft)`, matching the seed.
4. Rewards (final only): `pointsEarned` and the redeemed points update the contact's balance.
5. Payments: each gets a `refNo` via `takeRef("SP")` and posts to the method's default account from the location. Cash change is recorded as a return payment row (`isReturn: true`).
6. Set `paymentStatus` via `paymentStatus()`, `channel: "pos"`, and `createdBy`.
7. If `cart.resumedFromId` is set, delete that suspended or draft transaction.
8. Return the saved `Transaction`.

Other functions:
- `recent(locationId, status, limit=10)`: final, quotation, or draft
- `suspended(locationId)`
- `get(id)`
- `remove(id)`: drafts, quotations, and suspended sales only. Deleting a final sale belongs to sub-project 3.

### 2.4 Registers service (`lib/data/services/registers.ts`)

- `current(userId, locationId)` returns the open register or `null`.
- `open({ userId, locationId, openingCash })` throws if one is already open.
- `summary(registerId)` returns:
  - totals per payment method
  - total sales, total refunds (sell returns), expenses paid in cash
  - `expectedCash = opening + cash sales − cash change − cash refunds − cash expenses`
  - card slips count, cheque count
- `close(registerId, { closingAmount, totalCardSlips, totalCheques, denominations, note })`
- A register's activity is its **time window**: payments with `createdBy = register.userId` on transactions at `register.locationId`, where `openedAt ≤ paidOn ≤ closedAt` (or now while open). This works for seeded registers too, so transactions need no `registerId` field.
- Schema addition: `settings.pos.shippingCharges` (see §3.5). `SEED_VERSION` is bumped so stored data reseeds.

## 3. Screen

### 3.1 Top bar (h-14)
- Location select (user's locations), live clock (business TZ), a "Shortcuts ?" hint
- Icon buttons with tooltips:
  - Suspended (count badge), Recent transactions, Add expense, Register details, Close register, Calculator (reuses the shell widget), Today's profit (reuses the shell widget)
  - Sell return (→ `/sales/returns/new`), Back (→ `/home`)

### 3.2 Left pane (cart, ~44%, min 440px)
- **Customer combobox:** searches name, mobile, and code. It shows the balance due and reward points. ➕ opens the AddCustomer dialog (name, mobile, group, address), which calls a new `contactsService.createCustomer` (minimal version; sub-project 5 extends it into the full contact form).
- **Product search** (autofocus, F3):
  - As the user types, it shows suggestions: name, SKU, price, stock. Arrow keys and Enter pick one.
  - Scanner input (fast keystrokes ending in Enter) that exactly matches a SKU or variation SKU adds the item immediately.
  - A weighing-scale barcode (prefix match) is parsed into SKU and qty.
  - When nothing matches, it shows a toast.
  - ➕ opens `/products/new` in a new tab.
- **Meta row:** Technician select, invoice layout select (only when `showInvoiceLayout`), sale date (only when `enableTransactionDate`).
- **Cart table:**
  - Columns: # · product (name, SKU, stock-left hint) · qty stepper (unit-aware decimals) · price inc. tax (editable only when `subtotalEditable`, or via the row expand) · subtotal · ✕.
  - Clicking a row expands it to show unit price, discount (fixed/%), tax, note, serial/IMEI chips, and service staff (when enabled).
  - A newly added line flashes briefly and scrolls into view.
  - With an empty cart, the table shows an empty state with a scanner illustration hint.
- **Totals footer:** Items · Subtotal · Discount ✎ · Order tax ✎ · Shipping ✎ · Redeem points ✎ (only when rewards are enabled and the customer isn't walk-in) · Round-off. Each ✎ opens its dialog. Discount and order tax are hidden when disabled in settings.

### 3.3 Right pane (product grid)
- Tabs: All · Featured (location `featuredProductIds`)
- Category and brand chips (single select each), with search-free browsing
- Grid of cards, `auto-fill minmax(140px, 1fr)`. Each card shows the image or initials tile, name (2 lines), price, and a stock badge. Clicking adds the item; for variable products, a variation picker popover opens first. Out-of-stock cards are dimmed and disabled; managed stock ≤ alert shows an amber badge.
- Paged by 40, with more loaded on scroll (IntersectionObserver). Only active products for sale at this location are listed.

### 3.4 Bottom action bar (h-16, full width)
- Left, as secondary buttons:
  - Quotation, Draft (hidden if `disableDraft`), Suspend (hidden if `disableSuspend`)
  - Credit sale (hidden if `disableCreditSaleButton`), Card, Multiple pay (hidden if `disableMultiplePay`)
- Right:
  - bKash and Nagad, tinted with their brand colours and shown only if the location allows them
  - **Cash**, the primary button and the express checkout (hidden if `disableExpressCheckout`), then Cancel
- **Total payable** is shown large and tabular.
- The buttons for bKash, Nagad, Card, and Cash open the Payment dialog preset to that method with the full amount; Enter confirms. Express Cash skips the dialog when "given" isn't needed. Credit sale checks out final with no payment.
- Every button is disabled when the cart is empty.

### 3.5 Dialogs
- **Payment:**
  - Payment rows `{ method, amount, account, details }`, with "Add row" (shortcut) and a remaining-balance line.
  - Cash rows have a "Given" field and show the change.
  - When denominations are on for the method, a denomination grid (counts × notes) fills the amount. With `denominationStrict`, the counts must match.
  - Card rows ask for card number (last 4), holder, type, and txn no. bKash and Nagad rows ask for the mobile txn ID.
  - The finalize button (shortcut) is disabled while there's a shortfall, unless it's a credit sale to a named customer.
- **Discount:** fixed or %, with a preview. **Order tax:** tax rate select. **Shipping:** zone presets Inside Dhaka / Outside Dhaka / Free. Charges are prefilled from a new `settings.pos.shippingCharges { inside_dhaka: 60, outside_dhaka: 120 }` (a schema addition with those defaults) and can be edited per sale, plus details and address.
- **Redeem points:** available points, max redeemable, and the value preview (domain `rewards`).
- **Suspended sales:** a list of cards (ref, customer, items, total, time) with Resume and Delete. Suspend asks for an optional note.
- **Recent transactions:** a drawer (Sheet) with Final / Quotation / Draft tabs. Each row has Print (receipt modal), Edit (loads draft/quotation into the cart; final → `/sales/[id]/edit`), and Delete (draft/quotation, with confirm).
- **Register open:** a full-pane card with the opening cash amount, location, and user.
- **Register details / close:** the summary table per method, plus expected vs counted cash with the difference coloured. The close form adds counted cash, card slips, cheques, denominations, and a note. After closing, the POS locks again.
- **Add expense:** category, amount, method, note. Posts via the expense service. If sub-project 6 hasn't built it yet, this dialog writes an `expense` transaction directly through a minimal `expensesService.create`.
- **Weighing scale:** a barcode input with a parsed preview (SKU, qty).
- **Shortcuts:** a cheat sheet built from the settings map, opened with `?`.

### 3.6 Receipt
- `ReceiptModal` opens after `final` checkout, and when printing from Recent.
- `ThermalReceipt` is 80mm wide (`@page { size: 80mm auto; margin: 0 }`) with:
  - business name, location address and mobile, invoice no., date, cashier, customer
  - lines (name, qty × price, subtotal), totals, payments, change
  - points earned, a footer note, and a Code128 barcode of the invoice no. (a small inline SVG renderer)
- `A4Invoice` is a full-page layout of the same data.
- Print uses `window.print()` with a print-only portal containing only the chosen layout (`[data-print-root]`). Everything else is `data-print-hide`.
- Enter or "New sale" closes the modal and focuses search.
- Quotation and draft checkouts show a toast with the reference and a Print action.

## 4. Keyboard shortcuts
The settings strings (e.g. `shift+e`) are parsed by `useHotkeys`, which ignores them while typing in inputs, except function keys and Escape.
- **Defaults:**
  - Express checkout `shift+e`, pay & checkout `shift+p`, draft `shift+d`, cancel `shift+c`
  - Recent product qty `f4`, weighing scale `f9`, edit discount `shift+i`, edit order tax `shift+t`
  - Add payment row `shift+r`, finalize payment `shift+f`, add new product `f6`
- The seed binds `recentProductQty` to `f2` and `addNewProduct` to `f4`; the settings values win over the defaults above.
- **Fixed shortcuts:** `F3` focuses search, `?` opens the cheat sheet, and `Esc` closes the topmost dialog.

## 5. Errors and edge cases
- **Insufficient stock** (from checkout or at add time when the qty would exceed `maxQty`): a toast with the available qty. The offending row gets a danger ring. Checkout is aborted and the cart kept.
- **Credit limit and walk-in credit:** blocked with a reason in the payment dialog.
- **Serial required:** the row expands automatically with the serial field focused.
- **Location with no open register:** the gate shows. Registers are per user and location.
- **Product deactivated or deleted while in the cart:** checkout fails with `NotFoundError`. The toast names the product and the row is marked.
- **Every service error** is caught in one `usePosAction` wrapper, which shows a toast and never clears the cart.

## 6. i18n and a11y
- New `pos` namespace (en and bn), covered by the parity test. Numbers and money use `useFormat` (Bangla digits in bn).
- Every icon button has an `aria-label` and a tooltip.
- The cart is a `table` with a caption. The live total uses `aria-live="polite"`.
- Focus returns to search after each add, dialog close, and checkout.

## 7. Testing
- **Vitest:**
  - cart ops (merge on re-scan, qty/price/discount, clear/load)
  - selectors (totals with inclusive and exclusive tax, order discount, shipping, redeem, rounding, change and shortfall)
  - scale parser
  - `sales.checkout`: final with split payment, FIFO allocation and cost, invoice no., rewards, insufficient stock, credit limit, walk-in credit, suspend → resume deletes the original, and quotation/draft use no stock
  - registers: open twice throws, summary maths, close
- **Playwright smoke:** login → `/pos` → open register → scan by SKU → add a grid item → split Cash + bKash → receipt modal → Enter → Recent shows the invoice → `/products` stock went down → close register.

## 8. Acceptance
- Every planned POS screen element is present and working with mock data, as listed in §3 above.
- Checkout, suspend/resume, draft, quotation, credit sale, split pay, and the register open/close cycle all persist across reloads.
- The EN/BN and light/dark screens pass a visual check. Typecheck, lint, tests, and build are all clean.
