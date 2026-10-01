# POS Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/pos` placeholder with a full desktop cashier screen: register gate, scanner-friendly cart, product grid, split payments, suspend/draft/quotation, receipt printing, and register close. Everything runs on mock data.

**Architecture:** Pure, unit-tested logic lives in `lib/pos/*`. The data services `pos`, `sales`, `registers`, `expenses`, and `contacts.createCustomer` read and write the Zustand DB through `commit()`, and TanStack Query hooks wrap them. A persisted Zustand store (`lib/pos/store.ts`) holds one cart per location. UI components in `features/pos/*` only talk to hooks and the cart store, never to `getDB()`.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19.2.8, TypeScript, Tailwind v4, shadcn/ui (Radix), Zustand + persist, TanStack Query 5, next-intl 4 (`NEXT_LOCALE` cookie, no i18n routing), zod 3, sonner, lucide-react, date-fns 4, vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-possible-pos-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before using any Next.js API you haven't used in this repo (AGENTS.md). Next 16 differs from older versions.
- UI code never imports `@/lib/data/store/db` or `getDB`. Go through hooks in `lib/data/hooks/*`.
- Every DB write goes through `commit((draft) => …)`. A mutator that throws writes nothing.
- Services start with `await delay()` and throw `AppError` subclasses from `lib/data/errors.ts`.
- **Messages:**
  - Every user-visible string goes through `next-intl` `useTranslations()`.
  - Messages are generated only by `node scripts/messages.mjs messages`; never hand-edit `messages/*.json`.
  - Every key needs an `[en, bn]` pair. The parity test (`lib/i18n/messages.test.ts`) must pass.
- **React Compiler lint rules:**
  - No `setState` inside `useEffect`.
  - Use `Controller` rather than `watch()` with react-hook-form.
  - Put `// eslint-disable-next-line react-hooks/incompatible-library` above `useReactTable`.
- Money and quantity display: `useFormat()` (`f.money`, `f.qty`, `f.dateTime`). Money math: `roundMoney` from `lib/domain/money`.
- The class-name helper is `import { cn } from "cn"`.
- Walk-in customer id: `"walk-in"`. bKash = `custom_pay_1`, Nagad = `custom_pay_2`. Labels come from `settings.customLabels.payments[i]`.
- Minimum POS width is 1024px. Below that, show a notice.
- Commit after every task. The message ends with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run the dev server on port 3100 (`npx next dev -p 3100`). Stop it with `pkill -f "next dev"` and delete `.playwright-mcp/` after browser checks.
- Verification commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## File Map

```
scripts/messages.mjs                  (moved from scratchpad; source of messages/*.json)
lib/data/schemas/settings.ts          + pos.shippingCharges
lib/data/seed/settings.ts             + shippingCharges defaults
lib/data/seed/index.ts                SEED_VERSION 1 → 2
lib/pos/cart.ts        (+ .test.ts)   Cart types + pure ops
lib/pos/selectors.ts   (+ .test.ts)   cartTotals, paymentState
lib/pos/scale.ts       (+ .test.ts)   parseScaleBarcode
lib/pos/hotkeys.ts     (+ .test.ts)   parseHotkey, matchHotkey, useHotkeys
lib/pos/barcode.ts     (+ .test.ts)   code128 encoder (module widths)
lib/pos/methods.ts                    methodLabel, BKASH, NAGAD
lib/pos/store.ts                      useCart (persisted, per location)
lib/data/services/pos.ts      (+ .test.ts)  catalog for POS: products, search
lib/data/services/sales.ts    (+ .test.ts)  checkout, toCart, recent, suspended, receipt, remove
lib/data/services/registers.ts(+ .test.ts)  current, open, summary, close
lib/data/services/expenses.ts (+ .test.ts)  create (minimal)
lib/data/services/contacts.ts               + createCustomer (tested in contacts.test.ts)
lib/data/hooks/pos.ts                        all POS query/mutation hooks
features/pos/PosScreen.tsx, TopBar.tsx, ActionBar.tsx, Narrow.tsx, PosHotkeys.tsx
features/pos/{usePosAction,usePos,usePosCommands}.ts, focus.ts
features/pos/cart/{CustomerPicker,ProductSearch,MetaRow,CartTable,CartRow,CartTotals}.tsx
features/pos/grid/ProductGrid.tsx
features/pos/dialogs/{RegisterGate,Discount,OrderTax,Shipping,RedeemPoints,Payment,Denominations,Suspend,
                      SaleList,Suspended,Recent,RegisterClose,AddExpense,AddCustomer,WeighingScale,Shortcuts,Cancel}.tsx
features/pos/receipt/{ReceiptModal,ThermalReceipt,A4Invoice,Barcode,print}.tsx|ts
features/pos/dialogStore.ts           which dialog is open (tiny zustand store, not persisted)
app/(pos)/pos/page.tsx                renders <PosScreen/>
app/globals.css                       + print rules
```

---

### Task 0: Groundwork — messages generator, `pos` messages, shipping settings

**Files:**
- Create: `scripts/messages.mjs` (copied from `/private/tmp/claude-501/-Users-minhaz-Projects-Frontend-pos-sible/3bed0aa0-2d8c-467e-9450-95dfb4153502/scratchpad/messages.mjs`)
- Modify: `lib/data/schemas/settings.ts` (inside `pos: z.object({ … })`)
- Modify: `lib/data/seed/settings.ts` (inside `pos: { … }`)
- Modify: `lib/data/seed/index.ts:9`
- Regenerate: `messages/en.json`, `messages/bn.json`

**Interfaces:**
- Produces: message namespaces `pos.*` and `payMethods.*` (keys listed below, used verbatim by later tasks); `Settings["pos"]["shippingCharges"]: { inside_dhaka: number; outside_dhaka: number }`.

- [ ] **Step 1: Move the generator into the repo**

```bash
mkdir -p scripts
cp /private/tmp/claude-501/-Users-minhaz-Projects-Frontend-pos-sible/3bed0aa0-2d8c-467e-9450-95dfb4153502/scratchpad/messages.mjs scripts/messages.mjs
node scripts/messages.mjs messages && git diff --stat messages
```
Expected: no diff in `messages/` (the generator reproduces the current files).

- [ ] **Step 2: Add the `payMethods` and `pos` namespaces**

In `scripts/messages.mjs`, insert these two entries into `const M = { … }` right before `errors: {`:

```js
  payMethods: {
    cash: ["Cash", "নগদ"],
    card: ["Card", "কার্ড"],
    cheque: ["Cheque", "চেক"],
    bank_transfer: ["Bank transfer", "ব্যাংক ট্রান্সফার"],
    advance: ["Advance", "অগ্রিম"],
    other: ["Other", "অন্যান্য"],
    custom_pay_1: ["Custom payment 1", "কাস্টম পেমেন্ট ১"],
    custom_pay_2: ["Custom payment 2", "কাস্টম পেমেন্ট ২"],
    custom_pay_3: ["Custom payment 3", "কাস্টম পেমেন্ট ৩"],
    custom_pay_4: ["Custom payment 4", "কাস্টম পেমেন্ট ৪"],
    custom_pay_5: ["Custom payment 5", "কাস্টম পেমেন্ট ৫"],
    custom_pay_6: ["Custom payment 6", "কাস্টম পেমেন্ট ৬"],
    custom_pay_7: ["Custom payment 7", "কাস্টম পেমেন্ট ৭"],
  },
  pos: {
    narrow: ["The POS needs a screen at least 1024px wide.", "POS ব্যবহারের জন্য কমপক্ষে ১০২৪px চওড়া স্ক্রিন প্রয়োজন।"],
    top: {
      location: ["Location", "লোকেশন"],
      shortcuts: ["Shortcuts", "শর্টকাট"],
      suspended: ["Suspended sales", "স্থগিত বিক্রয়"],
      recent: ["Recent transactions", "সাম্প্রতিক লেনদেন"],
      addExpense: ["Add expense", "খরচ যোগ করুন"],
      registerDetails: ["Register details", "রেজিস্টারের বিবরণ"],
      closeRegister: ["Close register", "রেজিস্টার বন্ধ করুন"],
      sellReturn: ["Sell return", "বিক্রয় ফেরত"],
    },
    search: {
      placeholder: ["Scan barcode or search products (F3)", "বারকোড স্ক্যান করুন বা পণ্য খুঁজুন (F3)"],
      noMatch: ["No product matches “{term}”", "“{term}” এর সাথে কোনো পণ্য মেলেনি"],
      addProduct: ["Add new product", "নতুন পণ্য যোগ করুন"],
      inStock: ["{qty} in stock", "স্টকে {qty}"],
    },
    customer: {
      label: ["Customer", "গ্রাহক"],
      search: ["Search name, mobile or code…", "নাম, মোবাইল বা কোড খুঁজুন…"],
      due: ["Due {amount}", "বকেয়া {amount}"],
      points: ["{points} points", "{points} পয়েন্ট"],
      add: ["Add customer", "গ্রাহক যোগ করুন"],
      added: ["Customer added", "গ্রাহক যোগ হয়েছে"],
      name: ["Name", "নাম"],
      mobile: ["Mobile", "মোবাইল"],
      group: ["Customer group", "গ্রাহক গ্রুপ"],
      address: ["Address", "ঠিকানা"],
    },
    meta: {
      technician: ["Technician", "টেকনিশিয়ান"],
      none: ["None", "কোনোটি নয়"],
      layout: ["Invoice layout", "ইনভয়েস লেআউট"],
      date: ["Sale date", "বিক্রয়ের তারিখ"],
    },
    cart: {
      caption: ["Items in the current sale", "বর্তমান বিক্রয়ের পণ্যসমূহ"],
      product: ["Product", "পণ্য"],
      qty: ["Qty", "পরিমাণ"],
      price: ["Price", "দাম"],
      subtotal: ["Subtotal", "উপমোট"],
      empty: ["The cart is empty", "কার্ট খালি"],
      emptyHint: ["Scan a barcode, search above, or tap a product on the right.", "বারকোড স্ক্যান করুন, উপরে খুঁজুন অথবা ডানের পণ্যে ট্যাপ করুন।"],
      stockLeft: ["{qty} left", "{qty} বাকি"],
      unitPrice: ["Unit price", "একক দাম"],
      discount: ["Discount", "ছাড়"],
      note: ["Note", "নোট"],
      serials: ["Serial / IMEI", "সিরিয়াল / IMEI"],
      serialsHint: ["Press Enter after each number", "প্রতিটি নম্বরের পর Enter চাপুন"],
      serviceStaff: ["Service staff", "সার্ভিস স্টাফ"],
      remove: ["Remove {name}", "{name} সরান"],
      increase: ["Increase quantity", "পরিমাণ বাড়ান"],
      decrease: ["Decrease quantity", "পরিমাণ কমান"],
    },
    totals: {
      items: ["Items", "আইটেম"],
      subtotal: ["Subtotal", "উপমোট"],
      discount: ["Discount", "ছাড়"],
      orderTax: ["Order tax", "অর্ডার ট্যাক্স"],
      shipping: ["Shipping", "শিপিং"],
      redeemed: ["Points redeemed", "রিডিম করা পয়েন্ট"],
      roundOff: ["Round off", "রাউন্ড অফ"],
      payable: ["Total payable", "মোট প্রদেয়"],
      edit: ["Edit {what}", "{what} সম্পাদনা"],
    },
    discount: {
      title: ["Order discount", "অর্ডার ছাড়"],
      fixed: ["Fixed", "নির্দিষ্ট"],
      percentage: ["Percentage", "শতাংশ"],
      amount: ["Amount", "পরিমাণ"],
      preview: ["Discount: {amount}", "ছাড়: {amount}"],
    },
    orderTax: { title: ["Order tax", "অর্ডার ট্যাক্স"], none: ["No tax", "কোনো ট্যাক্স নেই"] },
    shipping: {
      title: ["Shipping", "শিপিং"],
      zone: ["Zone", "এলাকা"],
      inside_dhaka: ["Inside Dhaka", "ঢাকার ভিতরে"],
      outside_dhaka: ["Outside Dhaka", "ঢাকার বাইরে"],
      free: ["Free", "ফ্রি"],
      charges: ["Charges", "চার্জ"],
      details: ["Details", "বিবরণ"],
      address: ["Address", "ঠিকানা"],
    },
    points: {
      title: ["Redeem points", "পয়েন্ট রিডিম"],
      available: ["Available: {points}", "প্রাপ্য: {points}"],
      max: ["Max for this sale: {points}", "এই বিক্রয়ে সর্বোচ্চ: {points}"],
      value: ["Worth {amount}", "মূল্য {amount}"],
      label: ["Points to redeem", "রিডিম করার পয়েন্ট"],
    },
    grid: {
      all: ["All", "সব"],
      featured: ["Featured", "বাছাইকৃত"],
      allCategories: ["All categories", "সব ক্যাটাগরি"],
      allBrands: ["All brands", "সব ব্র্যান্ড"],
      outOfStock: ["Out of stock", "স্টক নেই"],
      lowStock: ["Low stock", "স্টক কম"],
      chooseVariation: ["Choose a variation", "একটি ভ্যারিয়েশন বাছুন"],
      empty: ["No products here", "এখানে কোনো পণ্য নেই"],
    },
    actions: {
      quotation: ["Quotation", "কোটেশন"],
      draft: ["Draft", "খসড়া"],
      suspend: ["Suspend", "স্থগিত"],
      creditSale: ["Credit sale", "বাকিতে বিক্রয়"],
      card: ["Card", "কার্ড"],
      multiplePay: ["Multiple pay", "একাধিক পেমেন্ট"],
      cash: ["Cash", "নগদ"],
      cancel: ["Cancel", "বাতিল"],
    },
    pay: {
      title: ["Payment", "পেমেন্ট"],
      addRow: ["Add payment row", "পেমেন্ট সারি যোগ করুন"],
      method: ["Method", "পদ্ধতি"],
      amount: ["Amount", "পরিমাণ"],
      given: ["Cash given", "প্রদত্ত নগদ"],
      change: ["Change", "ফেরত"],
      remaining: ["Remaining", "বাকি"],
      paid: ["Paid", "পরিশোধিত"],
      cardNumber: ["Card number (last 4)", "কার্ড নম্বর (শেষ ৪)"],
      cardHolder: ["Card holder", "কার্ডধারী"],
      cardType: ["Card type", "কার্ডের ধরন"],
      txnNo: ["Transaction ID", "ট্রানজেকশন আইডি"],
      denominations: ["Cash denominations", "নোটের হিসাব"],
      nonCashOverpaid: ["Only cash can be more than the total", "শুধু নগদ মোটের বেশি হতে পারে"],
      finalize: ["Finalize payment", "পেমেন্ট সম্পন্ন করুন"],
      removeRow: ["Remove payment row", "পেমেন্ট সারি সরান"],
    },
    errors: {
      walkInCredit: ["Choose a named customer for a credit sale", "বাকিতে বিক্রয়ের জন্য একজন গ্রাহক বাছুন"],
      serialsRequired: ["Enter {count} serial numbers for {product}", "{product} এর জন্য {count}টি সিরিয়াল নম্বর দিন"],
      productGone: ["{product} is no longer available", "{product} আর পাওয়া যাচ্ছে না"],
      emptyCart: ["Add at least one item", "অন্তত একটি পণ্য যোগ করুন"],
      notDeletable: ["Final sales can't be deleted here", "চূড়ান্ত বিক্রয় এখান থেকে মোছা যায় না"],
      registerOpen: ["A register is already open", "একটি রেজিস্টার ইতিমধ্যে খোলা আছে"],
      pointsInvalid: ["Those points can't be redeemed on this sale", "এই বিক্রয়ে এই পয়েন্ট রিডিম করা যাবে না"],
      noRegister: ["Open the register first", "প্রথমে রেজিস্টার খুলুন"],
    },
    done: {
      final: ["Sale {ref} completed", "বিক্রয় {ref} সম্পন্ন"],
      draft: ["Draft {ref} saved", "খসড়া {ref} সংরক্ষিত"],
      quotation: ["Quotation {ref} saved", "কোটেশন {ref} সংরক্ষিত"],
      suspended: ["Sale suspended as {ref}", "বিক্রয় {ref} হিসেবে স্থগিত"],
      cancelled: ["Sale cancelled", "বিক্রয় বাতিল"],
    },
    cancelConfirm: {
      title: ["Cancel this sale?", "এই বিক্রয় বাতিল করবেন?"],
      body: ["Every item in the cart will be removed.", "কার্টের সব পণ্য সরিয়ে ফেলা হবে।"],
    },
    suspend: {
      title: ["Suspend sale", "বিক্রয় স্থগিত"],
      note: ["Note (optional)", "নোট (ঐচ্ছিক)"],
      confirm: ["Suspend", "স্থগিত করুন"],
    },
    suspended: {
      title: ["Suspended sales", "স্থগিত বিক্রয়"],
      empty: ["No suspended sales", "কোনো স্থগিত বিক্রয় নেই"],
      resume: ["Resume", "আবার শুরু"],
      resumed: ["{ref} loaded into the cart", "{ref} কার্টে লোড হয়েছে"],
      replaceCart: ["The current cart will be replaced.", "বর্তমান কার্ট প্রতিস্থাপিত হবে।"],
    },
    recent: {
      title: ["Recent transactions", "সাম্প্রতিক লেনদেন"],
      empty: ["Nothing here yet", "এখনো কিছু নেই"],
      deleted: ["{ref} deleted", "{ref} মোছা হয়েছে"],
    },
    receipt: {
      title: ["Receipt", "রসিদ"],
      newSale: ["New sale", "নতুন বিক্রয়"],
      a4: ["A4 invoice", "A4 ইনভয়েস"],
      thermal: ["Receipt (80mm)", "রসিদ (৮০মিমি)"],
      invoiceNo: ["Invoice No.", "ইনভয়েস নং"],
      date: ["Date", "তারিখ"],
      cashier: ["Cashier", "ক্যাশিয়ার"],
      customer: ["Customer", "গ্রাহক"],
      item: ["Item", "পণ্য"],
      qty: ["Qty", "পরিমাণ"],
      unitPrice: ["Unit price", "একক দাম"],
      total: ["Total", "মোট"],
      paid: ["Paid", "পরিশোধিত"],
      change: ["Change", "ফেরত"],
      due: ["Due", "বকেয়া"],
      pointsEarned: ["Points earned: {points}", "অর্জিত পয়েন্ট: {points}"],
      mobile: ["Mobile", "মোবাইল"],
    },
    register: {
      openTitle: ["Open cash register", "ক্যাশ রেজিস্টার খুলুন"],
      openBody: ["Count the cash in the drawer to start selling at {location}.", "{location} এ বিক্রি শুরু করতে ড্রয়ারের নগদ গুনে লিখুন।"],
      openingCash: ["Cash in hand", "হাতে নগদ"],
      open: ["Open register", "রেজিস্টার খুলুন"],
      opened: ["Register opened", "রেজিস্টার খোলা হয়েছে"],
      openedAt: ["Opened {time}", "খোলা হয়েছে {time}"],
      detailsTitle: ["Register details", "রেজিস্টারের বিবরণ"],
      closeTitle: ["Close register", "রেজিস্টার বন্ধ করুন"],
      method: ["Payment method", "পেমেন্ট পদ্ধতি"],
      amount: ["Amount", "পরিমাণ"],
      opening: ["Opening cash", "শুরুর নগদ"],
      sales: ["Total sales", "মোট বিক্রয়"],
      refunds: ["Cash refunds", "নগদ ফেরত"],
      expenses: ["Cash expenses", "নগদ খরচ"],
      change: ["Change given", "ফেরত দেওয়া"],
      expected: ["Expected cash", "প্রত্যাশিত নগদ"],
      counted: ["Counted cash", "গণনাকৃত নগদ"],
      difference: ["Difference", "পার্থক্য"],
      cardSlips: ["Card slips", "কার্ড স্লিপ"],
      cheques: ["Cheques", "চেক"],
      note: ["Closing note", "বন্ধের নোট"],
      closed: ["Register closed", "রেজিস্টার বন্ধ হয়েছে"],
    },
    expense: {
      title: ["Add expense", "খরচ যোগ করুন"],
      category: ["Category", "ক্যাটাগরি"],
      amount: ["Amount", "পরিমাণ"],
      method: ["Paid with", "যেভাবে পরিশোধ"],
      note: ["Note", "নোট"],
      added: ["Expense {ref} added", "খরচ {ref} যোগ হয়েছে"],
    },
    scale: {
      title: ["Weighing scale barcode", "ওজন মাপার বারকোড"],
      barcode: ["Barcode", "বারকোড"],
      parsed: ["SKU {sku} · Qty {qty}", "SKU {sku} · পরিমাণ {qty}"],
      invalid: ["Not a weighing-scale barcode", "এটি ওজন মাপার বারকোড নয়"],
    },
    shortcuts: {
      title: ["Keyboard shortcuts", "কিবোর্ড শর্টকাট"],
      focusSearch: ["Focus product search", "পণ্য খোঁজায় যান"],
      help: ["Show this list", "এই তালিকা দেখান"],
      expressCheckout: ["Express checkout (cash)", "দ্রুত চেকআউট (নগদ)"],
      payAndCheckout: ["Pay & checkout", "পেমেন্ট ও চেকআউট"],
      draft: ["Save as draft", "খসড়া হিসেবে সংরক্ষণ"],
      cancel: ["Cancel sale", "বিক্রয় বাতিল"],
      recentProductQty: ["Edit last item's quantity", "শেষ পণ্যের পরিমাণ সম্পাদনা"],
      weighingScale: ["Weighing scale", "ওজন মাপার যন্ত্র"],
      editDiscount: ["Edit discount", "ছাড় সম্পাদনা"],
      editOrderTax: ["Edit order tax", "অর্ডার ট্যাক্স সম্পাদনা"],
      addPaymentRow: ["Add payment row", "পেমেন্ট সারি যোগ"],
      finalizePayment: ["Finalize payment", "পেমেন্ট সম্পন্ন"],
      addNewProduct: ["Add new product", "নতুন পণ্য যোগ"],
      unset: ["Not set", "নির্ধারিত নয়"],
    },
  },
```

- [ ] **Step 3: Add `shippingCharges` to the settings schema and seed**

In `lib/data/schemas/settings.ts`, inside `pos: z.object({`, after the `weighingScale: z.object({ … }),` entry add:

```ts
    shippingCharges: z.object({ inside_dhaka: z.number(), outside_dhaka: z.number() }),
```

In `lib/data/seed/settings.ts`, inside `pos: {`, after `weighingScale: { prefix: "", skuLength: 5, qtyLength: 3, qtyDecimalLength: 2 },` add:

```ts
      shippingCharges: { inside_dhaka: 60, outside_dhaka: 120 },
```

In `lib/data/seed/index.ts` change `export const SEED_VERSION = 1;` to `export const SEED_VERSION = 2;` (stored v1 data lacks the new setting, and the persist `migrate` drops it so DataGate reseeds).

- [ ] **Step 4: Regenerate and verify**

```bash
node scripts/messages.mjs messages
npm test && npm run typecheck
```
Expected: all tests pass (including `messages.test.ts` parity) and typecheck is clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/messages.mjs messages lib/data/schemas/settings.ts lib/data/seed/settings.ts lib/data/seed/index.ts
git commit -m "chore(pos): messages generator in repo, pos messages, shipping charges setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Cart model and pure operations

**Files:**
- Create: `lib/pos/cart.ts`
- Test: `lib/pos/cart.test.ts`

**Interfaces:**
- Produces (exact names, used by Tasks 2, 5, 6, 8–12):

```ts
export type ShippingZone = "inside_dhaka" | "outside_dhaka" | "free";
export type CartLine = {
  key: string; productId: string; variationId: string; name: string; sku: string;
  unitId: string; unitName: string; allowDecimal: boolean;
  qty: number; unitPrice: number; taxId: string | null; taxRate: number; taxType: "inclusive" | "exclusive";
  discount: DiscountInput | null; note: string; serials: string[]; serviceStaffId: string | null;
  enableSerial: boolean; maxQty: number | null;
};
export type CartShipping = { zone: ShippingZone | null; charges: number; details: string; address: string };
export type Cart = {
  lines: CartLine[]; contactId: string; discount: DiscountInput | null; orderTaxId: string | null; orderTaxRate: number;
  shipping: CartShipping; technicianId: string | null; invoiceLayoutId: string | null; date: string | null;
  pointsRedeemed: number; resumedFromId: string | null; note: string;
};
export type AddItemInput = Omit<CartLine, "key" | "qty" | "note" | "serials" | "serviceStaffId"> & { qty?: number };
export const WALK_IN_ID = "walk-in";
export function emptyCart(): Cart;
export function addItem(c: Cart, item: AddItemInput, mode?: "increase_qty" | "new_row"): Cart;
export function setQty(c: Cart, key: string, qty: number): Cart;
export function setPrice(c: Cart, key: string, unitPrice: number): Cart;
export function setLineDiscount(c: Cart, key: string, d: DiscountInput | null): Cart;
export function setLineNote(c: Cart, key: string, note: string): Cart;
export function setSerials(c: Cart, key: string, serials: string[]): Cart;
export function setServiceStaff(c: Cart, key: string, id: string | null): Cart;
export function removeLine(c: Cart, key: string): Cart;
export function patchCart(c: Cart, patch: Partial<Omit<Cart, "lines">>): Cart;
export function setContact(c: Cart, contactId: string): Cart; // also resets pointsRedeemed
export function exceedsStock(line: CartLine, qty?: number): boolean;
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/pos/cart.test.ts
import { describe, expect, it } from "vitest";
import {
  addItem, emptyCart, exceedsStock, patchCart, removeLine, setContact, setLineDiscount, setPrice, setQty, setSerials,
  type AddItemInput,
} from "./cart";

const rice: AddItemInput = {
  productId: "p1", variationId: "v1", name: "Rice 25kg", sku: "R25", unitId: "u_pc", unitName: "Pc", allowDecimal: false,
  unitPrice: 1500, taxId: null, taxRate: 0, taxType: "exclusive", discount: null, enableSerial: false, maxQty: 3,
};
const feed: AddItemInput = { ...rice, productId: "p2", variationId: "v2", name: "Feed", sku: "F1", allowDecimal: true, maxQty: null };

describe("cart", () => {
  it("adds a new line with qty 1 by default", () => {
    const c = addItem(emptyCart(), rice);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]).toMatchObject({ variationId: "v1", qty: 1, note: "", serials: [] });
  });

  it("re-scanning the same variation increases qty in increase_qty mode", () => {
    const c = addItem(addItem(emptyCart(), rice), rice);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0].qty).toBe(2);
  });

  it("new_row mode always appends", () => {
    const c = addItem(addItem(emptyCart(), rice, "new_row"), rice, "new_row");
    expect(c.lines).toHaveLength(2);
    expect(c.lines[0].key).not.toBe(c.lines[1].key);
  });

  it("setQty rounds integers for non-decimal units and removes nothing at 0", () => {
    let c = addItem(emptyCart(), rice);
    c = setQty(c, c.lines[0].key, 2.6);
    expect(c.lines[0].qty).toBe(3);
    c = setQty(c, c.lines[0].key, 0);
    expect(c.lines[0].qty).toBe(1); // minimum is one unit; removal is explicit
  });

  it("setQty keeps decimals for decimal units", () => {
    let c = addItem(emptyCart(), feed);
    c = setQty(c, c.lines[0].key, 12.5);
    expect(c.lines[0].qty).toBe(12.5);
  });

  it("price, discount, serials and removal", () => {
    let c = addItem(addItem(emptyCart(), rice), feed);
    const k = c.lines[0].key;
    c = setPrice(c, k, 1450);
    c = setLineDiscount(c, k, { type: "percentage", amount: 5 });
    c = setSerials(c, k, [" A1 ", "", "A2"]);
    expect(c.lines[0]).toMatchObject({ unitPrice: 1450, discount: { type: "percentage", amount: 5 }, serials: ["A1", "A2"] });
    c = removeLine(c, k);
    expect(c.lines.map((l) => l.variationId)).toEqual(["v2"]);
  });

  it("changing customer clears redeemed points", () => {
    const c = setContact(patchCart(emptyCart(), { pointsRedeemed: 40 }), "cust_1");
    expect(c).toMatchObject({ contactId: "cust_1", pointsRedeemed: 0 });
  });

  it("exceedsStock respects unmanaged stock", () => {
    const c = addItem(emptyCart(), rice);
    expect(exceedsStock(c.lines[0], 4)).toBe(true);
    expect(exceedsStock(c.lines[0], 3)).toBe(false);
    expect(exceedsStock(addItem(emptyCart(), feed).lines[0], 9999)).toBe(false);
  });

  it("ops never mutate the input", () => {
    const a = addItem(emptyCart(), rice);
    const snapshot = structuredClone(a);
    setQty(a, a.lines[0].key, 2);
    removeLine(a, a.lines[0].key);
    expect(a).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/pos/cart.test.ts`
Expected: FAIL (`Cannot find module './cart'`).

- [ ] **Step 3: Implement**

```ts
// lib/pos/cart.ts
import { roundMoney } from "@/lib/domain/money";
import type { DiscountInput } from "@/lib/domain/totals";

export type ShippingZone = "inside_dhaka" | "outside_dhaka" | "free";

export type CartLine = {
  key: string;
  productId: string;
  variationId: string;
  name: string;
  sku: string;
  unitId: string;
  unitName: string;
  allowDecimal: boolean;
  qty: number;
  /** Follows the product's taxType: inc. tax when "inclusive", exc. when "exclusive". */
  unitPrice: number;
  taxId: string | null;
  taxRate: number;
  taxType: "inclusive" | "exclusive";
  discount: DiscountInput | null;
  note: string;
  serials: string[];
  serviceStaffId: string | null;
  enableSerial: boolean;
  /** Stock available at the location when added; null when stock isn't managed. */
  maxQty: number | null;
};

export type CartShipping = { zone: ShippingZone | null; charges: number; details: string; address: string };

export type Cart = {
  lines: CartLine[];
  contactId: string;
  discount: DiscountInput | null;
  orderTaxId: string | null;
  orderTaxRate: number;
  shipping: CartShipping;
  technicianId: string | null;
  invoiceLayoutId: string | null;
  /** null = now at checkout. */
  date: string | null;
  pointsRedeemed: number;
  /** Suspended/draft/quotation this cart was loaded from; checkout replaces it. */
  resumedFromId: string | null;
  note: string;
};

export type AddItemInput = Omit<CartLine, "key" | "qty" | "note" | "serials" | "serviceStaffId"> & { qty?: number };

export const WALK_IN_ID = "walk-in";

export function emptyCart(): Cart {
  return {
    lines: [],
    contactId: WALK_IN_ID,
    discount: null,
    orderTaxId: null,
    orderTaxRate: 0,
    shipping: { zone: null, charges: 0, details: "", address: "" },
    technicianId: null,
    invoiceLayoutId: null,
    date: null,
    pointsRedeemed: 0,
    resumedFromId: null,
    note: "",
  };
}

const newKey = () => Math.random().toString(36).slice(2, 10);

const normQty = (line: Pick<CartLine, "allowDecimal">, qty: number) => {
  const q = line.allowDecimal ? roundMoney(qty, 4) : Math.round(qty);
  return Math.max(line.allowDecimal ? 0.0001 : 1, q);
};

const mapLine = (c: Cart, key: string, fn: (l: CartLine) => CartLine): Cart => ({
  ...c,
  lines: c.lines.map((l) => (l.key === key ? fn(l) : l)),
});

export function addItem(c: Cart, item: AddItemInput, mode: "increase_qty" | "new_row" = "increase_qty"): Cart {
  const qty = item.qty ?? 1;
  const existing = mode === "increase_qty" ? c.lines.find((l) => l.variationId === item.variationId) : undefined;
  if (existing) return mapLine(c, existing.key, (l) => ({ ...l, qty: normQty(l, l.qty + qty) }));
  const { qty: _ignored, ...rest } = item;
  const line: CartLine = { ...rest, key: newKey(), qty: normQty(item, qty), note: "", serials: [], serviceStaffId: null };
  return { ...c, lines: [...c.lines, line] };
}

export const setQty = (c: Cart, key: string, qty: number) => mapLine(c, key, (l) => ({ ...l, qty: normQty(l, qty) }));
export const setPrice = (c: Cart, key: string, unitPrice: number) =>
  mapLine(c, key, (l) => ({ ...l, unitPrice: Math.max(0, roundMoney(unitPrice)) }));
export const setLineDiscount = (c: Cart, key: string, discount: DiscountInput | null) =>
  mapLine(c, key, (l) => ({ ...l, discount: discount && discount.amount > 0 ? discount : null }));
export const setLineNote = (c: Cart, key: string, note: string) => mapLine(c, key, (l) => ({ ...l, note }));
export const setSerials = (c: Cart, key: string, serials: string[]) =>
  mapLine(c, key, (l) => ({ ...l, serials: serials.map((s) => s.trim()).filter(Boolean) }));
export const setServiceStaff = (c: Cart, key: string, serviceStaffId: string | null) =>
  mapLine(c, key, (l) => ({ ...l, serviceStaffId }));
export const removeLine = (c: Cart, key: string): Cart => ({ ...c, lines: c.lines.filter((l) => l.key !== key) });
export const patchCart = (c: Cart, patch: Partial<Omit<Cart, "lines">>): Cart => ({ ...c, ...patch });
export const setContact = (c: Cart, contactId: string): Cart => ({ ...c, contactId, pointsRedeemed: 0 });

export function exceedsStock(line: CartLine, qty: number = line.qty): boolean {
  return line.maxQty != null && qty > line.maxQty;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/pos/cart.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pos/cart.ts lib/pos/cart.test.ts
git commit -m "feat(pos): cart model and pure operations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Selectors, scale parser, hotkeys, barcode, method labels

**Files:**
- Create: `lib/pos/selectors.ts`, `lib/pos/scale.ts`, `lib/pos/hotkeys.ts`, `lib/pos/barcode.ts`, `lib/pos/methods.ts`
- Test: `lib/pos/selectors.test.ts`, `lib/pos/scale.test.ts`, `lib/pos/hotkeys.test.ts`, `lib/pos/barcode.test.ts`

**Interfaces:**
- Consumes: `Cart`, `CartLine` from Task 1.
- Produces:

```ts
// selectors.ts
export type CartTotals = OrderTotals & { lines: LineTotals[] };
export type TotalsContext = { rounding: RoundingMode; rewards: RewardSettings };
export function cartTotals(c: Cart, ctx: TotalsContext): CartTotals;
export type PayRow = { method: PaymentMethod; amount: number };
export type PaymentState = { paid: number; change: number; shortfall: number; nonCashOverpaid: boolean };
export function paymentState(payable: number, rows: PayRow[]): PaymentState;
// scale.ts
export type ScaleSettings = { prefix: string; skuLength: number; qtyLength: number; qtyDecimalLength: number };
export function parseScaleBarcode(code: string, s: ScaleSettings): { sku: string; qty: number } | null;
// hotkeys.ts
export type Hotkey = { key: string; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
export function parseHotkey(spec: string): Hotkey | null;
export function matchHotkey(e: KeyLike, spec: string): boolean;
export function formatHotkey(spec: string): string; // "shift+e" → "Shift + E"
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled?: boolean): void;
// barcode.ts
export function code128(text: string): number[]; // alternating bar/space module widths, starts with a bar
// methods.ts
export const BKASH: PaymentMethod; export const NAGAD: PaymentMethod;
export function methodLabel(m: PaymentMethod, t: (k: string) => string, customLabels: string[]): string;
```

- [ ] **Step 1: Write failing tests**

```ts
// lib/pos/selectors.test.ts
import { describe, expect, it } from "vitest";
import { addItem, emptyCart, patchCart, type AddItemInput } from "./cart";
import { cartTotals, paymentState } from "./selectors";

const rewards = {
  enabled: true, amountForUnitPoint: 100, minOrderTotalToEarn: 0, maxPointsPerOrder: null,
  redeemAmountPerPoint: 1, minOrderTotalToRedeem: 0, minRedeemPoint: 0, maxRedeemPoint: null,
};
const item = (over: Partial<AddItemInput> = {}): AddItemInput => ({
  productId: "p", variationId: "v", name: "X", sku: "X", unitId: "u", unitName: "Pc", allowDecimal: false,
  unitPrice: 100, taxId: null, taxRate: 0, taxType: "exclusive", discount: null, enableSerial: false, maxQty: null, ...over,
});

describe("cartTotals", () => {
  it("sums exclusive and inclusive lines", () => {
    let c = addItem(emptyCart(), item({ qty: 2 }));
    c = addItem(c, item({ variationId: "v2", unitPrice: 115, taxRate: 15, taxType: "inclusive" }));
    const t = cartTotals(c, { rounding: "none", rewards });
    expect(t.lines.map((l) => l.subtotal)).toEqual([200, 115]);
    expect(t).toMatchObject({ itemsCount: 3, linesTotal: 315, total: 315 });
  });

  it("applies order discount, order tax, shipping, redeemed points and rounding", () => {
    let c = addItem(emptyCart(), item({ unitPrice: 1000.4 }));
    c = patchCart(c, {
      discount: { type: "percentage", amount: 10 }, orderTaxRate: 5,
      shipping: { zone: "inside_dhaka", charges: 60, details: "", address: "" }, pointsRedeemed: 20,
    });
    const t = cartTotals(c, { rounding: "whole", rewards });
    // 1000.40 − 100.04 = 900.36; tax 45.02; +60 −20 = 985.38 → 985
    expect(t).toMatchObject({ discount: 100.04, orderTax: 45.02, shipping: 60, redeemed: 20, total: 985, roundOff: -0.38 });
  });
});

describe("paymentState", () => {
  it("exact payment", () => {
    expect(paymentState(500, [{ method: "cash", amount: 500 }])).toEqual({ paid: 500, change: 0, shortfall: 0, nonCashOverpaid: false });
  });
  it("cash overpayment becomes change", () => {
    expect(paymentState(480, [{ method: "custom_pay_1", amount: 300 }, { method: "cash", amount: 200 }])).toMatchObject({ change: 20, shortfall: 0 });
  });
  it("shortfall when underpaid", () => {
    expect(paymentState(500, [{ method: "card", amount: 200 }])).toMatchObject({ paid: 200, shortfall: 300 });
  });
  it("flags non-cash overpayment", () => {
    expect(paymentState(500, [{ method: "card", amount: 600 }]).nonCashOverpaid).toBe(true);
    expect(paymentState(500, [{ method: "card", amount: 450 }, { method: "cash", amount: 100 }]).nonCashOverpaid).toBe(false);
  });
});
```

```ts
// lib/pos/scale.test.ts
import { describe, expect, it } from "vitest";
import { parseScaleBarcode } from "./scale";

const s = { prefix: "21", skuLength: 5, qtyLength: 3, qtyDecimalLength: 2 };

describe("parseScaleBarcode", () => {
  it("splits prefix, sku, integer and decimal quantity", () => {
    expect(parseScaleBarcode("21" + "00123" + "012" + "50", s)).toEqual({ sku: "00123", qty: 12.5 });
  });
  it("ignores a trailing check digit", () => {
    expect(parseScaleBarcode("2100123001257", s)).toEqual({ sku: "00123", qty: 1.25 });
  });
  it("rejects wrong prefix, short codes and non-digit quantities", () => {
    expect(parseScaleBarcode("2200123001250", s)).toBeNull();
    expect(parseScaleBarcode("21001230", s)).toBeNull();
    expect(parseScaleBarcode("2100123abc50", s)).toBeNull();
  });
  it("an empty prefix never matches (feature needs a prefix)", () => {
    expect(parseScaleBarcode("0012301250", { ...s, prefix: "" })).toBeNull();
  });
});
```

```ts
// lib/pos/hotkeys.test.ts
import { describe, expect, it } from "vitest";
import { formatHotkey, matchHotkey, parseHotkey } from "./hotkeys";

const ev = (key: string, mods: Partial<Record<"shiftKey" | "ctrlKey" | "altKey" | "metaKey", boolean>> = {}) => ({
  key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods,
});

describe("hotkeys", () => {
  it("parses modifiers and key", () => {
    expect(parseHotkey("Shift+E")).toEqual({ key: "e", shift: true, ctrl: false, alt: false, meta: false });
    expect(parseHotkey("f2")).toEqual({ key: "f2", shift: false, ctrl: false, alt: false, meta: false });
    expect(parseHotkey("")).toBeNull();
  });
  it("matches events case-insensitively with exact modifiers", () => {
    expect(matchHotkey(ev("E", { shiftKey: true }), "shift+e")).toBe(true);
    expect(matchHotkey(ev("e"), "shift+e")).toBe(false);
    expect(matchHotkey(ev("F2"), "f2")).toBe(true);
    expect(matchHotkey(ev("F2", { ctrlKey: true }), "f2")).toBe(false);
    expect(matchHotkey(ev("?", { shiftKey: true }), "?")).toBe(true); // printable symbols ignore shift
  });
  it("formats for display", () => {
    expect(formatHotkey("shift+e")).toBe("Shift + E");
    expect(formatHotkey("f4")).toBe("F4");
  });
});
```

```ts
// lib/pos/barcode.test.ts
import { describe, expect, it } from "vitest";
import { code128 } from "./barcode";

describe("code128", () => {
  it("encodes start B + data + checksum + stop with the right module count", () => {
    const w = code128("HQ-00012");
    const modules = w.reduce((s, n) => s + n, 0);
    // (start + 8 chars + checksum) × 11 modules + stop 13
    expect(modules).toBe((1 + 8 + 1) * 11 + 13);
    expect(w.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]); // Start B
    expect(w.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]); // Stop
  });
  it("replaces characters outside Code 128 B with '?'", () => {
    expect(code128("ক")).toEqual(code128("?"));
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npx vitest run lib/pos`
Expected: FAIL on the four new files (modules missing); `cart.test.ts` still passes.

- [ ] **Step 3: Implement**

```ts
// lib/pos/selectors.ts
import type { PaymentMethod } from "@/lib/data/schemas";
import { roundMoney, type RoundingMode } from "@/lib/domain/money";
import { redeemValue, type RewardSettings } from "@/lib/domain/rewards";
import { lineTotals, orderTotals, type LineTotals, type OrderTotals } from "@/lib/domain/totals";
import type { Cart } from "./cart";

export type CartTotals = OrderTotals & { lines: LineTotals[] };
export type TotalsContext = { rounding: RoundingMode; rewards: RewardSettings };

export function cartTotals(c: Cart, ctx: TotalsContext): CartTotals {
  const inputs = c.lines.map((l) => ({
    qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate, taxType: l.taxType, discount: l.discount ?? undefined,
  }));
  const totals = orderTotals({
    lines: inputs,
    discount: c.discount ?? undefined,
    orderTaxRate: c.orderTaxRate,
    shipping: c.shipping.charges,
    rounding: ctx.rounding,
    pointsRedeemed: redeemValue(c.pointsRedeemed, ctx.rewards),
  });
  return { ...totals, lines: inputs.map(lineTotals) };
}

export type PayRow = { method: PaymentMethod; amount: number };
export type PaymentState = { paid: number; change: number; shortfall: number; nonCashOverpaid: boolean };

/** Change is only ever given in cash, and only up to the cash tendered. */
export function paymentState(payable: number, rows: PayRow[]): PaymentState {
  const paid = roundMoney(rows.reduce((s, r) => s + (r.amount || 0), 0));
  const cash = roundMoney(rows.filter((r) => r.method === "cash").reduce((s, r) => s + (r.amount || 0), 0));
  const nonCash = roundMoney(paid - cash);
  const over = roundMoney(Math.max(0, paid - payable));
  return {
    paid,
    change: roundMoney(Math.min(over, cash)),
    shortfall: roundMoney(Math.max(0, payable - paid)),
    nonCashOverpaid: nonCash > payable,
  };
}
```

```ts
// lib/pos/scale.ts
export type ScaleSettings = { prefix: string; skuLength: number; qtyLength: number; qtyDecimalLength: number };

/** Weighing-scale label: prefix + SKU + integer qty digits + decimal qty digits (+ optional check digit). */
export function parseScaleBarcode(code: string, s: ScaleSettings): { sku: string; qty: number } | null {
  const c = code.trim();
  if (!s.prefix || !c.startsWith(s.prefix)) return null;
  const body = c.slice(s.prefix.length);
  const need = s.skuLength + s.qtyLength + s.qtyDecimalLength;
  if (body.length < need) return null;
  const sku = body.slice(0, s.skuLength);
  const int = body.slice(s.skuLength, s.skuLength + s.qtyLength);
  const dec = body.slice(s.skuLength + s.qtyLength, need);
  if (!/^\d+$/.test(int + dec)) return null;
  const qty = Number(`${int}.${dec || "0"}`);
  return qty > 0 ? { sku, qty } : null;
}
```

```ts
// lib/pos/hotkeys.ts
"use client";

import { useEffect, useRef } from "react";

export type Hotkey = { key: string; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
export type KeyLike = { key: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean };

export function parseHotkey(spec: string): Hotkey | null {
  const parts = spec.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  return { key, shift: parts.includes("shift"), ctrl: parts.includes("ctrl"), alt: parts.includes("alt"), meta: parts.includes("meta") };
}

const printable = (k: string) => k.length === 1 && !/[a-z0-9]/.test(k);

export function matchHotkey(e: KeyLike, spec: string): boolean {
  const h = parseHotkey(spec);
  if (!h || e.key.toLowerCase() !== h.key) return false;
  const shiftOk = printable(h.key) || e.shiftKey === h.shift;
  return shiftOk && e.ctrlKey === h.ctrl && e.altKey === h.alt && e.metaKey === h.meta;
}

export function formatHotkey(spec: string): string {
  return spec
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join(" + ");
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Window-level shortcuts. While typing in a field only function keys, Escape and
 * modifier combos fire, so "?" or "e" can still be typed into inputs.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      for (const [spec, fn] of Object.entries(ref.current)) {
        if (!spec || !matchHotkey(e, spec)) continue;
        const h = parseHotkey(spec)!;
        const fnKey = /^f\d{1,2}$/.test(h.key) || h.key === "escape";
        if (isTyping(e.target) && !fnKey && !h.ctrl && !h.alt && !h.meta && !(h.shift && h.key.length === 1 && /[a-z]/.test(h.key))) continue;
        e.preventDefault();
        fn(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
```

> Note on the typing rule: The original product binds `shift+<letter>` shortcuts that fire even while the search box has focus (cashiers type product names in lowercase). Uppercase letters typed with Shift inside inputs therefore trigger the shortcut. That is intended and matches the reference app.

```ts
// lib/pos/barcode.ts
/** Code 128 bar/space module widths (6 per symbol, 7 for stop), indexed by symbol value. */
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232",
  "122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122",
  "321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311",
  "211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113",
  "213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422",
  "121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111",
  "241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121",
  "412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412",
  "211214","211232","2331112",
];
const START_B = 104;
const STOP = 106;

/** Encodes printable ASCII with code set B. Returns alternating bar/space widths, starting with a bar. */
export function code128(text: string): number[] {
  const values = [...text].map((ch) => {
    const c = ch.charCodeAt(0);
    return c >= 32 && c <= 126 ? c - 32 : "?".charCodeAt(0) - 32;
  });
  const checksum = values.reduce((s, v, i) => s + v * (i + 1), START_B) % 103;
  return [START_B, ...values, checksum, STOP].flatMap((v) => [...PATTERNS[v]].map(Number));
}
```

```ts
// lib/pos/methods.ts
import type { PaymentMethod } from "@/lib/data/schemas";

export const BKASH: PaymentMethod = "custom_pay_1";
export const NAGAD: PaymentMethod = "custom_pay_2";

/** Custom methods use the business's label ("bKash") when set, else the generic message. */
export function methodLabel(m: PaymentMethod, t: (key: string) => string, customLabels: string[]): string {
  const match = /^custom_pay_(\d)$/.exec(m);
  const custom = match ? customLabels[Number(match[1]) - 1]?.trim() : "";
  return custom || t(`payMethods.${m}`);
}

/** Methods offered at the till: the location's list, minus unlabeled custom methods. */
export function tillMethods(locationMethods: PaymentMethod[], customLabels: string[]): PaymentMethod[] {
  return locationMethods.filter((m) => {
    const match = /^custom_pay_(\d)$/.exec(m);
    return !match || !!customLabels[Number(match[1]) - 1]?.trim();
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/pos`
Expected: PASS (cart 9, selectors 6, scale 4, hotkeys 3, barcode 2).

- [ ] **Step 5: Commit**

```bash
git add lib/pos
git commit -m "feat(pos): totals and payment selectors, scale parser, hotkeys, code128, method labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: POS catalog service (grid + search)

**Files:**
- Create: `lib/data/services/pos.ts`
- Test: `lib/data/services/pos.test.ts`

**Interfaces:**
- Consumes: `AddItemInput` (Task 1).
- Produces:

```ts
export type PosVariation = { id: string; name: string; sku: string; unitPrice: number; priceInc: number; stock: number };
export type PosProduct = {
  id: string; name: string; sku: string; image: string | null; type: "single" | "variable" | "combo";
  categoryId: string | null; brandId: string | null; unitId: string; unitName: string; allowDecimal: boolean;
  taxId: string | null; taxRate: number; taxType: "inclusive" | "exclusive"; manageStock: boolean; alertQty: number | null;
  enableSerial: boolean; stock: number; priceInc: number; variations: PosVariation[];
};
export type PosCatalogQuery = { locationId: string; contactId?: string; categoryId?: string; brandId?: string; featured?: boolean; page?: number; pageSize?: number };
export type PosSearchHit = { product: PosProduct; variation: PosVariation; exact: boolean };
export function toCartItem(p: PosProduct, v: PosVariation, qty?: number): AddItemInput;
export const posService: {
  products(q: PosCatalogQuery): Promise<ListResult<PosProduct>>;
  search(q: { locationId: string; contactId?: string; term: string; limit?: number }): Promise<PosSearchHit[]>;
  bySku(q: { locationId: string; contactId?: string; sku: string }): Promise<PosSearchHit | null>;
};
```

Rules:
- A product is sellable at a location when it is `active`, `!notForSale`, and `locationIds` includes the location.
- `unitPrice` follows the product's `taxType`: `sellPriceInc` when inclusive, `sellPriceExc` when exclusive. It then goes through `resolveUnitPrice` with the location's `priceGroupId` and the contact's customer group. **Group pricing only applies to untaxed products**, the same rule the seed uses.
- An active product discount (`findDiscount`, today's date) becomes the line `discount`. `toCartItem` receives it via `PosProduct.discount`, so add `discount: DiscountInput | null` to `PosProduct`.
- `stock` is summed from lots at the location. `maxQty` is `null` when `!manageStock`, otherwise the variation stock.
- Search ranking:
  - Exact SKU or variation SKU match → `exact: true` and first place.
  - Then name prefix, name contains, and SKU contains.
  - The limit defaults to 10.

- [ ] **Step 1: Write the failing test**

```ts
// lib/data/services/pos.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { posService, toCartItem } from "./pos";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("posService", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("lists only sellable products at the location", async () => {
    const res = await posService.products({ locationId: LOC_RANGO, pageSize: -1 });
    const db = getDB();
    for (const p of res.rows) {
      const src = db.products.find((x) => x.id === p.id)!;
      expect(src.active && !src.notForSale && src.locationIds.includes(LOC_RANGO)).toBe(true);
    }
    expect(res.total).toBeGreaterThan(0);
  });

  it("hides deactivated products", async () => {
    const first = (await posService.products({ locationId: LOC_RANGO, pageSize: 1 })).rows[0];
    commit((d) => { d.products.find((p) => p.id === first.id)!.active = false; });
    const ids = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.map((p) => p.id);
    expect(ids).not.toContain(first.id);
  });

  it("stock is the location's lot sum", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock)!;
    const lots = getDB().stockLots.filter((l) => l.productId === p.id && l.locationId === LOC_RANGO);
    expect(p.stock).toBeCloseTo(lots.reduce((s, l) => s + l.qtyRemaining, 0), 4);
  });

  it("finds an exact SKU first and flags it", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: 1 })).rows[0];
    const sku = p.variations[0].sku;
    const hits = await posService.search({ locationId: LOC_RANGO, term: sku.toLowerCase() });
    expect(hits[0]).toMatchObject({ exact: true });
    expect(hits[0].variation.sku).toBe(sku);
    expect(await posService.bySku({ locationId: LOC_RANGO, sku })).not.toBeNull();
    expect(await posService.bySku({ locationId: LOC_RANGO, sku: "NOPE-000" })).toBeNull();
  });

  it("toCartItem maps price, tax and stock limit", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock)!;
    const item = toCartItem(p, p.variations[0]);
    expect(item).toMatchObject({
      productId: p.id, variationId: p.variations[0].id, unitPrice: p.variations[0].unitPrice,
      taxType: p.taxType, maxQty: p.variations[0].stock,
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/data/services/pos.test.ts`
Expected: FAIL (`Cannot find module './pos'`).

- [ ] **Step 3: Implement**

```ts
// lib/data/services/pos.ts
import type { DB, Product } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { findDiscount } from "@/lib/domain/discounts";
import { roundMoney } from "@/lib/domain/money";
import { resolveUnitPrice } from "@/lib/domain/pricing";
import type { DiscountInput } from "@/lib/domain/totals";
import type { AddItemInput } from "@/lib/pos/cart";
import { delay, paginate, type ListResult } from "./_util";

export type PosVariation = { id: string; name: string; sku: string; unitPrice: number; priceInc: number; stock: number };

export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  image: string | null;
  type: Product["type"];
  categoryId: string | null;
  brandId: string | null;
  unitId: string;
  unitName: string;
  allowDecimal: boolean;
  taxId: string | null;
  taxRate: number;
  taxType: "inclusive" | "exclusive";
  manageStock: boolean;
  alertQty: number | null;
  enableSerial: boolean;
  stock: number;
  priceInc: number;
  discount: DiscountInput | null;
  variations: PosVariation[];
};

export type PosCatalogQuery = {
  locationId: string;
  contactId?: string;
  categoryId?: string;
  brandId?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
};

export type PosSearchHit = { product: PosProduct; variation: PosVariation; exact: boolean };

function catalog(db: DB, locationId: string, contactId?: string): PosProduct[] {
  const loc = db.locations.find((l) => l.id === locationId);
  const contact = contactId ? db.contacts.find((c) => c.id === contactId) : undefined;
  const group = contact?.customerGroupId ? db.customerGroups.find((g) => g.id === contact.customerGroupId) : undefined;
  const units = new Map(db.units.map((u) => [u.id, u]));
  const taxes = new Map(db.taxRates.map((t) => [t.id, t.rate]));
  const vars = Map.groupBy(db.variations, (v) => v.productId);
  const stock = new Map<string, number>();
  for (const l of db.stockLots) {
    if (l.locationId === locationId) stock.set(l.variationId, (stock.get(l.variationId) ?? 0) + l.qtyRemaining);
  }
  const today = todayISO();

  return db.products
    .filter((p) => p.active && !p.notForSale && p.locationIds.includes(locationId))
    .map((p) => {
      const taxRate = p.taxId ? taxes.get(p.taxId) ?? 0 : 0;
      const variations = (vars.get(p.id) ?? []).map((v): PosVariation => {
        const base = p.taxType === "inclusive" ? v.sellPriceInc : v.sellPriceExc;
        const unitPrice = p.taxId
          ? base
          : resolveUnitPrice({ defaultPrice: base, groupPrices: v.groupPrices, priceGroupId: loc?.priceGroupId, customerGroup: group ?? null });
        const priceInc = p.taxType === "inclusive" ? unitPrice : roundMoney(unitPrice * (1 + taxRate / 100));
        return { id: v.id, name: v.name, sku: v.sku, unitPrice, priceInc, stock: roundMoney(stock.get(v.id) ?? 0, 4) };
      });
      const rule = findDiscount(db.discounts, { productId: p.id, brandId: p.brandId, categoryId: p.categoryId, locationId, at: today });
      const unit = units.get(p.unitId);
      return {
        id: p.id, name: p.name, sku: p.sku, image: p.image, type: p.type, categoryId: p.categoryId, brandId: p.brandId,
        unitId: p.unitId, unitName: unit?.shortName ?? "", allowDecimal: unit?.allowDecimal ?? false,
        taxId: p.taxId, taxRate, taxType: p.taxType, manageStock: p.manageStock, alertQty: p.alertQty, enableSerial: p.enableSerial,
        stock: roundMoney(variations.reduce((s, v) => s + v.stock, 0), 4),
        priceInc: variations[0]?.priceInc ?? 0,
        discount: rule ? { type: rule.type, amount: rule.amount } : null,
        variations,
      };
    });
}

export function toCartItem(p: PosProduct, v: PosVariation, qty = 1): AddItemInput {
  return {
    productId: p.id,
    variationId: v.id,
    name: p.type === "variable" ? `${p.name} (${v.name})` : p.name,
    sku: v.sku,
    unitId: p.unitId,
    unitName: p.unitName,
    allowDecimal: p.allowDecimal,
    qty,
    unitPrice: v.unitPrice,
    taxId: p.taxId,
    taxRate: p.taxRate,
    taxType: p.taxType,
    discount: p.discount,
    enableSerial: p.enableSerial,
    maxQty: p.manageStock ? v.stock : null,
  };
}

function rank(p: PosProduct, v: PosVariation, term: string): number {
  const name = p.name.toLowerCase();
  const sku = v.sku.toLowerCase();
  if (sku === term || (p.sku.toLowerCase() === term && p.variations.length === 1)) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term) || v.name.toLowerCase().includes(term)) return 2;
  if (sku.includes(term)) return 3;
  return -1;
}

export const posService = {
  async products(q: PosCatalogQuery): Promise<ListResult<PosProduct>> {
    await delay();
    const db = getDB();
    const featured = q.featured ? new Set(db.locations.find((l) => l.id === q.locationId)?.featuredProductIds ?? []) : null;
    const rows = catalog(db, q.locationId, q.contactId)
      .filter(
        (p) =>
          (!q.categoryId || p.categoryId === q.categoryId || db.products.find((x) => x.id === p.id)?.subCategoryId === q.categoryId) &&
          (!q.brandId || p.brandId === q.brandId) &&
          (!featured || featured.has(p.id)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return paginate(rows, { page: q.page, pageSize: q.pageSize ?? 40 });
  },

  async search(q: { locationId: string; contactId?: string; term: string; limit?: number }): Promise<PosSearchHit[]> {
    await delay();
    const term = q.term.trim().toLowerCase();
    if (!term) return [];
    return catalog(getDB(), q.locationId, q.contactId)
      .flatMap((p) => p.variations.map((v) => ({ product: p, variation: v, r: rank(p, v, term) })))
      .filter((h) => h.r >= 0)
      .sort((a, b) => a.r - b.r || a.product.name.localeCompare(b.product.name))
      .slice(0, q.limit ?? 10)
      .map(({ product, variation, r }) => ({ product, variation, exact: r === 0 }));
  },

  async bySku(q: { locationId: string; contactId?: string; sku: string }): Promise<PosSearchHit | null> {
    const hits = await posService.search({ ...q, term: q.sku, limit: 1 });
    return hits[0]?.exact ? hits[0] : null;
  },
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/data/services/pos.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/services/pos.ts lib/data/services/pos.test.ts
git commit -m "feat(pos): catalog service for grid and scanner search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Customer quick-add, expense create, POS error types

**Files:**
- Modify: `lib/data/errors.ts` (append two classes)
- Modify: `lib/data/services/contacts.ts` (add `createCustomer` to `contactsService`)
- Create: `lib/data/services/expenses.ts`
- Test: `lib/data/services/contacts.test.ts`, `lib/data/services/expenses.test.ts`

**Interfaces:**
- Produces:

```ts
// errors.ts
export class SerialsRequiredError extends AppError { productName: string; count: number } // code "serials_required"
export class ProductUnavailableError extends AppError { productName: string }            // code "product_unavailable"
// contacts.ts
export type NewCustomer = { name: string; mobile: string; customerGroupId?: string | null; address?: string };
contactsService.createCustomer(input: NewCustomer): Promise<Contact>;
// expenses.ts
export type NewExpense = { locationId: string; categoryId: string; amount: number; method: PaymentMethod; note?: string };
export const expensesService: { create(input: NewExpense): Promise<Transaction> };
```

- [ ] **Step 1: Write failing tests**

```ts
// lib/data/services/contacts.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { contactsService } from "./contacts";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("contactsService.createCustomer", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("creates an active customer with the next contact code", async () => {
    const before = getDB().contacts.length;
    const maxCode = Math.max(...getDB().contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0));
    const c = await contactsService.createCustomer({ name: "  Rahim Uddin ", mobile: "01711000000", address: "Mirpur 10" });
    expect(c).toMatchObject({ type: "customer", name: "Rahim Uddin", mobile: "01711000000", active: true, points: 0 });
    expect(c.code).toBe(`CO${String(maxCode + 1).padStart(4, "0")}`);
    expect(c.address.line1).toBe("Mirpur 10");
    expect(getDB().contacts).toHaveLength(before + 1);
  });

  it("requires name and mobile", async () => {
    await expect(contactsService.createCustomer({ name: " ", mobile: "" })).rejects.toBeInstanceOf(ValidationError);
  });
});
```

```ts
// lib/data/services/expenses.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { expensesService } from "./expenses";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("expensesService.create", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
  });

  it("records a paid expense with a ledger debit", async () => {
    const cat = getDB().expenseCategories[0];
    const t = await expensesService.create({ locationId: LOC_RANGO, categoryId: cat.id, amount: 250, method: "cash", note: "Tea" });
    expect(t).toMatchObject({ type: "expense", status: "final", paymentStatus: "paid", createdBy: "user_cashier", notes: "Tea" });
    expect(t.refNo).toMatch(/^EP\d{4}\/\d{4}$/);
    expect(t.payments[0]).toMatchObject({ amount: 250, method: "cash", createdBy: "user_cashier" });
    const at = getDB().accountTxns.find((a) => a.paymentId === t.payments[0].id)!;
    expect(at).toMatchObject({ kind: "debit", amount: 250, subType: "payment" });
  });

  it("rejects non-positive amounts", async () => {
    const cat = getDB().expenseCategories[0];
    await expect(expensesService.create({ locationId: LOC_RANGO, categoryId: cat.id, amount: 0, method: "cash" })).rejects.toBeInstanceOf(ValidationError);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/data/services/contacts.test.ts lib/data/services/expenses.test.ts`
Expected: FAIL (`createCustomer is not a function`, and `./expenses` missing).

- [ ] **Step 3: Implement**

Append to `lib/data/errors.ts`:

```ts
export class SerialsRequiredError extends AppError {
  constructor(
    public productName: string,
    public count: number,
  ) {
    super(`Enter ${count} serial numbers for ${productName}.`, "serials_required");
  }
}

export class ProductUnavailableError extends AppError {
  constructor(public productName: string) {
    super(`${productName} is no longer available.`, "product_unavailable");
  }
}
```

In `lib/data/services/contacts.ts`:
- Change the import line to `import { NotFoundError, ValidationError } from "@/lib/data/errors";`.
- Change `import type { Contact, DB } from "@/lib/data/schemas";` to `import { contact, type Contact, type DB } from "@/lib/data/schemas";` and `import { currentUser } from "@/lib/auth/session";`.
- Extend the `_util` import to include `nowISO, uid`.
- Add above `export const contactsService`:

```ts
export type NewCustomer = { name: string; mobile: string; customerGroupId?: string | null; address?: string };
```

Then add this method inside `contactsService`, after `setActive`:

```ts
  async createCustomer(input: NewCustomer): Promise<Contact> {
    await delay();
    const name = input.name.trim();
    const mobile = input.mobile.trim();
    const fields: Record<string, string> = {};
    if (!name) fields.name = "required";
    if (!mobile) fields.mobile = "required";
    if (Object.keys(fields).length) throw new ValidationError(fields);
    let created!: Contact;
    commit((d) => {
      const n = Math.max(0, ...d.contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0)) + 1;
      created = contact.parse({
        id: uid("c"),
        createdAt: nowISO(),
        createdBy: currentUser()?.user.id ?? null,
        code: `${d.settings.prefixes.contacts}${String(n).padStart(4, "0")}`,
        type: "customer",
        name,
        mobile,
        customerGroupId: input.customerGroupId ?? null,
        address: { line1: input.address?.trim() ?? "" },
      });
      d.contacts.push(created);
    });
    return created;
  },
```

```ts
// lib/data/services/expenses.ts
import { currentUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { accountTxn, transaction, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, takeRef, uid } from "./_util";

export type NewExpense = { locationId: string; categoryId: string; amount: number; method: PaymentMethod; note?: string };

export const expensesService = {
  /** Minimal paid expense (POS "Add expense"); the full form arrives with the Expenses sub-project. */
  async create(input: NewExpense): Promise<Transaction> {
    await delay();
    const amount = roundMoney(input.amount);
    if (!(amount > 0)) throw new ValidationError({ amount: "positive" });
    if (!input.categoryId) throw new ValidationError({ categoryId: "required" });
    let created!: Transaction;
    commit((d) => {
      const at = nowISO();
      const by = currentUser()?.user.id ?? null;
      const tid = uid("t");
      const pid = uid("pay");
      const accountId = d.locations.find((l) => l.id === input.locationId)?.defaultAccounts[input.method] ?? null;
      created = transaction.parse({
        id: tid, createdAt: at, createdBy: by, type: "expense", status: "final", locationId: input.locationId,
        refNo: takeRef(d, d.settings.prefixes.expense, at), date: at, lines: [],
        totals: { itemsCount: 0, linesTotal: amount, discount: 0, orderTax: 0, shipping: 0, additional: 0, redeemed: 0, roundOff: 0, total: amount },
        payments: [{ id: pid, refNo: takeRef(d, d.settings.prefixes.expensePayment, at), amount, method: input.method, accountId, paidOn: at, createdBy: by }],
        paymentStatus: "paid", expenseCategoryId: input.categoryId, notes: input.note?.trim() ?? "",
      });
      d.transactions.push(created);
      if (accountId) {
        d.accountTxns.push(accountTxn.parse({
          id: uid("at"), createdAt: at, createdBy: by, accountId, kind: "debit", subType: "payment", amount, date: at, transactionId: tid, paymentId: pid,
        }));
      }
    });
    return created;
  },
};
```


- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/data/services`
Expected: PASS (all services tests, including the new ones).

- [ ] **Step 5: Commit**

```bash
git add lib/data/errors.ts lib/data/services/contacts.ts lib/data/services/contacts.test.ts lib/data/services/expenses.ts lib/data/services/expenses.test.ts
git commit -m "feat(pos): quick-add customer, POS expense, serial/availability errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sales service — checkout and friends

**Files:**
- Create: `lib/data/services/sales.ts`
- Test: `lib/data/services/sales.test.ts`

**Interfaces:**
- Consumes:
  - `Cart` and `emptyCart`, `addItem`, `patchCart` (Task 1)
  - `cartTotals`, `paymentState` (Task 2)
  - `posService`, `toCartItem` (Task 3)
  - `SerialsRequiredError`, `ProductUnavailableError` (Task 4)
- Produces:

```ts
export type SaleStatus = "final" | "draft" | "quotation" | "suspended";
export type CheckoutPayment = { method: PaymentMethod; amount: number; details?: Payment["details"]; note?: string };
export type CheckoutInput = { cart: Cart; locationId: string; status: SaleStatus; payments?: CheckoutPayment[]; staffNote?: string };
export type CheckoutResult = { id: string; refNo: string; status: SaleStatus; total: number; paid: number; change: number; due: number };
export type SaleRow = { id: string; refNo: string; date: string; status: SaleStatus; contactName: string; itemsCount: number; total: number; note: string };
export type ReceiptLine = { name: string; sku: string; unitName: string; qty: number; unitPrice: number; discount: number; subtotal: number; serials: string[] };
export type ReceiptData = {
  txn: Transaction; location: Location; layout: InvoiceLayout; a4Layout: InvoiceLayout; businessName: string; logo: string | null;
  customer: { name: string; mobile: string; isWalkIn: boolean }; cashier: string; lines: ReceiptLine[];
  paid: number; change: number; due: number;
};
export const salesService: {
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
  toCart(id: string): Promise<Cart>;
  list(q: { locationId: string; status: SaleStatus; limit?: number }): Promise<SaleRow[]>;
  receipt(id: string): Promise<ReceiptData>;
  remove(id: string): Promise<void>;
};
```

**Checkout rules** (spec § Checkout; all inside one `commit`, so any throw writes nothing):
1. Empty cart: throw `AppError("Add at least one item", "empty_cart")`.
2. Each line's product must still exist, be `active`, not `notForSale`, and include the location in `locationIds`. Otherwise throw `ProductUnavailableError(name)`.
3. `final` only:
   - A product with `enableSerial` needs `serials.length === qty`, else `SerialsRequiredError`.
   - A product with `manageStock` gets `allocate(...)` with `settings.business.accountingMethod` and `settings.sale.allowOverselling`.
   - A shortfall throws `InsufficientStockError(name, available)`.
   - Otherwise decrement each lot's `qtyRemaining` (skip `lotId === "oversell"`). Set `unitCost = cost / qty`.
4. Totals come from `cartTotals(cart, { rounding: settings.sale.roundingMethod, rewards: settings.rewards })`.
5. `pointsRedeemed` must be ≤ `maxRedeemable({ total: totals.total + totals.redeemed, balance: contact.points, s: settings.rewards })`, else `ValidationError({ pointsRedeemed: "invalid" })`. The walk-in customer can't redeem.
6. Payments (`final` only) are the rows with `amount > 0`:
   - `paymentState(total, rows).nonCashOverpaid` → `ValidationError({ payments: "non_cash_overpaid" })`.
   - Each row becomes a payment (`refNo` via `takeRef(d, prefixes.sellPayment)`, `accountId` from `location.defaultAccounts[method]`, `createdBy` = current user) plus a **credit** `accountTxn`.
   - `change > 0` adds one extra cash payment `{ isReturn: true, amount: change }` with a **debit** `accountTxn`.
7. If `due > 0` on a `final` sale:
   - A walk-in customer throws `AppError("…", "walk_in_credit")`.
   - A `creditLimit` that the customer's existing due plus this due would exceed throws `CreditLimitError()`.
8. Reference numbers:
   - `final`: `nextInvoiceNo(scheme)` then `scheme.count += 1`, using `location.invoiceSchemeId`.
   - Any other status: `takeRef(d, settings.prefixes.draft)`.
9. Points (`final`, named customer): `contact.points += pointsEarned(total) − pointsRedeemed`, and store `pointsEarned` on the transaction.
10. If `cart.resumedFromId` is set, delete that transaction, but only when it's a non-final `sell`.
11. Build the transaction with `channel: "pos"` and `date: cart.date ?? nowISO()`. For a final sale with shipping, set `shipping.status: "ordered"`. Set `paymentStatus` via `paymentStatus({ total, paid, date, payTerm: contact.payTerm })` (`"due"` for non-final). Also store `invoiceSchemeId`, `invoiceLayoutId: cart.invoiceLayoutId`, `technicianId`, `staffNote` and `notes: cart.note`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/data/services/sales.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { AppError, CreditLimitError, InsufficientStockError, ProductUnavailableError, SerialsRequiredError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO, WALK_IN } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart, patchCart, setContact, setSerials, type Cart } from "@/lib/pos/cart";
import { posService, toCartItem, type PosProduct } from "./pos";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

async function stocked(pred: (p: PosProduct) => boolean = () => true) {
  const rows = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows;
  return rows.find((p) => p.type !== "combo" && p.manageStock && !p.enableSerial && p.stock >= 2 && p.variations[0].stock >= 2 && pred(p))!;
}
const cartWith = (p: PosProduct, qty = 1): Cart => addItem(emptyCart(), toCartItem(p, p.variations[0], qty));
const customer = () => getDB().contacts.find((c) => c.type === "customer" && !c.isDefault && c.creditLimit == null)!;

describe("salesService.checkout", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
  });

  it("cash sale: invoice number, stock, ledger, paid", async () => {
    const p = await stocked();
    const cart = cartWith(p, 2);
    const scheme = getDB().invoiceSchemes.find((s) => s.id === getDB().locations.find((l) => l.id === LOC_RANGO)!.invoiceSchemeId)!;
    const countBefore = scheme.count;
    const stockBefore = p.variations[0].stock;
    const total = (await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [] }).catch((e) => e)) as AppError;
    expect(total).toBeInstanceOf(AppError); // walk-in with no payment = credit → rejected
    expect(total.code).toBe("walk_in_credit");

    const probe = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "quotation" });
    const payable = probe.total;
    const res = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: payable + 20 }] });
    expect(res).toMatchObject({ status: "final", paid: payable + 20, change: 20, due: 0 });

    const db = getDB();
    const t = db.transactions.find((x) => x.id === res.id)!;
    expect(t).toMatchObject({ type: "sell", status: "final", channel: "pos", paymentStatus: "paid", createdBy: "user_cashier", contactId: WALK_IN });
    expect(db.invoiceSchemes.find((s) => s.id === scheme.id)!.count).toBe(countBefore + 1);
    expect(t.payments.map((x) => [x.method, x.amount, x.isReturn])).toEqual([["cash", payable + 20, false], ["cash", 20, true]]);
    expect(db.accountTxns.filter((a) => a.transactionId === t.id).map((a) => a.kind)).toEqual(["credit", "debit"]);
    const left = db.stockLots.filter((l) => l.variationId === p.variations[0].id && l.locationId === LOC_RANGO).reduce((s, l) => s + l.qtyRemaining, 0);
    expect(left).toBeCloseTo(stockBefore - 2, 4);
    expect(t.lines[0].allocations.length).toBeGreaterThan(0);
  });

  it("split payment bKash + cash", async () => {
    const p = await stocked();
    const cart = cartWith(p);
    const { total } = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "quotation" });
    const res = await salesService.checkout({
      cart, locationId: LOC_RANGO, status: "final",
      payments: [{ method: "custom_pay_1", amount: 1, details: { txnNo: "ABC123" } }, { method: "cash", amount: total - 1 }],
    });
    const t = getDB().transactions.find((x) => x.id === res.id)!;
    expect(t.payments.map((x) => x.method)).toEqual(["custom_pay_1", "cash"]);
    expect(t.payments[0].details.txnNo).toBe("ABC123");
  });

  it("rejects non-cash overpayment", async () => {
    const p = await stocked();
    await expect(
      salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "card", amount: 10_000_000 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("insufficient stock writes nothing", async () => {
    const p = await stocked();
    const before = structuredClone(getDB());
    const cart = addItem(emptyCart(), { ...toCartItem(p, p.variations[0]), qty: p.variations[0].stock + 1000 });
    commit((d) => { d.settings.sale.allowOverselling = false; });
    const snapshot = structuredClone(getDB());
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e9 }] })).rejects.toBeInstanceOf(InsufficientStockError);
    expect(getDB()).toEqual(snapshot);
    expect(before.transactions.length).toBe(getDB().transactions.length);
  });

  it("serial products need one serial per unit", async () => {
    const rows = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows;
    const phone = rows.find((p) => p.enableSerial && p.stock >= 1)!;
    let cart = addItem(emptyCart(), toCartItem(phone, phone.variations.find((v) => v.stock >= 1)!));
    const { total } = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "quotation" });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: total }] })).rejects.toBeInstanceOf(SerialsRequiredError);
    cart = setSerials(cart, cart.lines[0].key, ["356789012345678"]);
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: total }] })).resolves.toMatchObject({ status: "final" });
  });

  it("product deactivated after it was added", async () => {
    const p = await stocked();
    const cart = cartWith(p);
    commit((d) => { d.products.find((x) => x.id === p.id)!.active = false; });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "suspended" })).rejects.toBeInstanceOf(ProductUnavailableError);
  });

  it("credit sale to a named customer updates due and points", async () => {
    const p = await stocked();
    const c = customer();
    const pointsBefore = c.points;
    const res = await salesService.checkout({ cart: setContact(cartWith(p), c.id), locationId: LOC_RANGO, status: "final", payments: [] });
    expect(res.due).toBe(res.total);
    const t = getDB().transactions.find((x) => x.id === res.id)!;
    expect(t.paymentStatus).toBe("due");
    expect(getDB().contacts.find((x) => x.id === c.id)!.points).toBe(pointsBefore + t.pointsEarned);
  });

  it("credit limit is enforced", async () => {
    const p = await stocked();
    const c = customer();
    commit((d) => { d.contacts.find((x) => x.id === c.id)!.creditLimit = 1; });
    await expect(salesService.checkout({ cart: setContact(cartWith(p), c.id), locationId: LOC_RANGO, status: "final", payments: [] })).rejects.toBeInstanceOf(CreditLimitError);
  });

  it("suspend, resume into a cart, finalize replaces the suspended sale", async () => {
    const p = await stocked();
    const s = await salesService.checkout({ cart: cartWith(p, 2), locationId: LOC_RANGO, status: "suspended", staffNote: "Back in 5" });
    expect(s.refNo).toMatch(/^DR\d{4}\/\d{4}$/);
    const rows = await salesService.list({ locationId: LOC_RANGO, status: "suspended" });
    expect(rows.find((r) => r.id === s.id)).toMatchObject({ note: "Back in 5", itemsCount: 2 });

    const cart = await salesService.toCart(s.id);
    expect(cart).toMatchObject({ resumedFromId: s.id });
    expect(cart.lines[0]).toMatchObject({ variationId: p.variations[0].id, qty: 2, name: expect.any(String) });

    const res = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: s.total }] });
    expect(getDB().transactions.some((t) => t.id === s.id)).toBe(false);
    expect(getDB().transactions.some((t) => t.id === res.id)).toBe(true);
  });

  it("points redemption is capped by balance", async () => {
    const p = await stocked();
    const c = customer();
    const cart = patchCart(setContact(cartWith(p), c.id), { pointsRedeemed: c.points + 1 });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("receipt resolves names and payment summary", async () => {
    const p = await stocked();
    const { total } = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "quotation" });
    const res = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: total + 5 }] });
    const r = await salesService.receipt(res.id);
    expect(r.lines[0].name).toBe(p.name);
    expect(r).toMatchObject({ paid: total + 5, change: 5, due: 0, customer: { isWalkIn: true } });
    expect(r.cashier.length).toBeGreaterThan(0);
  });

  it("remove deletes drafts but refuses final sales", async () => {
    const p = await stocked();
    const d = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "draft" });
    await salesService.remove(d.id);
    expect(getDB().transactions.some((t) => t.id === d.id)).toBe(false);
    const f = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] });
    await expect(salesService.remove(f.id)).rejects.toMatchObject({ code: "not_deletable" });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/data/services/sales.test.ts`
Expected: FAIL (`Cannot find module './sales'`).

- [ ] **Step 3: Implement**

```ts
// lib/data/services/sales.ts
import { currentUser } from "@/lib/auth/session";
import {
  AppError, CreditLimitError, InsufficientStockError, NotFoundError, ProductUnavailableError, SerialsRequiredError, ValidationError,
} from "@/lib/data/errors";
import { accountTxn, transaction, type DB, type InvoiceLayout, type Location, type Payment, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentStatus, paymentSummary } from "@/lib/domain/payments";
import { nextInvoiceNo } from "@/lib/domain/refs";
import { maxRedeemable, pointsEarned } from "@/lib/domain/rewards";
import { allocate, available } from "@/lib/domain/stock";
import { emptyCart, WALK_IN_ID, type Cart, type CartLine } from "@/lib/pos/cart";
import { cartTotals, paymentState } from "@/lib/pos/selectors";
import { delay, nowISO, takeRef, uid } from "./_util";

export type SaleStatus = "final" | "draft" | "quotation" | "suspended";
export type CheckoutPayment = { method: PaymentMethod; amount: number; details?: Payment["details"]; note?: string };
export type CheckoutInput = { cart: Cart; locationId: string; status: SaleStatus; payments?: CheckoutPayment[]; staffNote?: string };
export type CheckoutResult = { id: string; refNo: string; status: SaleStatus; total: number; paid: number; change: number; due: number };
export type SaleRow = { id: string; refNo: string; date: string; status: SaleStatus; contactName: string; itemsCount: number; total: number; note: string };
export type ReceiptLine = { name: string; sku: string; unitName: string; qty: number; unitPrice: number; discount: number; subtotal: number; serials: string[] };
export type ReceiptData = {
  txn: Transaction;
  location: Location;
  layout: InvoiceLayout;
  a4Layout: InvoiceLayout;
  businessName: string;
  logo: string | null;
  customer: { name: string; mobile: string; isWalkIn: boolean };
  cashier: string;
  lines: ReceiptLine[];
  paid: number;
  change: number;
  due: number;
};

const EDITABLE: Transaction["status"][] = ["draft", "quotation", "suspended"];

/** Outstanding amount on a customer's final sells, plus opening balance. */
function customerDue(d: DB, contactId: string): number {
  const c = d.contacts.find((x) => x.id === contactId);
  const sells = d.transactions.filter((t) => t.type === "sell" && t.status === "final" && t.contactId === contactId);
  return roundMoney(sells.reduce((s, t) => s + paymentSummary(t.totals.total, t.payments).due, c?.openingBalance ?? 0));
}

function lineAllocation(d: DB, line: CartLine, locationId: string, name: string) {
  const res = allocate(d.stockLots, {
    variationId: line.variationId, locationId, qty: line.qty,
    method: d.settings.business.accountingMethod, allowOverselling: d.settings.sale.allowOverselling,
  });
  if (res.shortfall > 0) throw new InsufficientStockError(name, available(d.stockLots, line.variationId, locationId));
  for (const a of res.allocations) {
    const lot = d.stockLots.find((l) => l.id === a.lotId);
    if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining - a.qty, 4);
  }
  return { allocations: res.allocations, unitCost: roundMoney(res.cost / line.qty) };
}

export const salesService = {
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    await delay();
    const { cart, locationId, status } = input;
    if (!cart.lines.length) throw new AppError("Add at least one item", "empty_cart");
    let result!: CheckoutResult;

    commit((d) => {
      const s = d.settings;
      const at = cart.date ?? nowISO();
      const by = currentUser()?.user.id ?? null;
      const location = d.locations.find((l) => l.id === locationId);
      if (!location) throw new NotFoundError("Location");
      const contact = d.contacts.find((c) => c.id === cart.contactId);
      if (!contact) throw new NotFoundError("Contact");
      const isWalkIn = contact.id === WALK_IN_ID || contact.isDefault;

      const totals = cartTotals(cart, { rounding: s.sale.roundingMethod, rewards: s.rewards });
      const tid = uid("t");

      const lines = cart.lines.map((l, i) => {
        const p = d.products.find((x) => x.id === l.productId);
        if (!p || !p.active || p.notForSale || !p.locationIds.includes(locationId)) throw new ProductUnavailableError(l.name);
        let allocations: { lotId: string; qty: number; unitCost: number }[] = [];
        let unitCost = d.variations.find((v) => v.id === l.variationId)?.purchasePriceExc ?? 0;
        if (status === "final") {
          if (p.enableSerial && l.serials.length !== l.qty) throw new SerialsRequiredError(l.name, l.qty);
          if (p.manageStock) ({ allocations, unitCost } = lineAllocation(d, l, locationId, l.name));
        }
        return {
          id: uid("l"), productId: l.productId, variationId: l.variationId, unitId: l.unitId, qty: l.qty, unitPrice: l.unitPrice,
          taxId: l.taxId, taxRate: l.taxRate, taxType: l.taxType, discount: l.discount, subtotal: totals.lines[i].subtotal,
          unitCost, allocations, note: l.note, serials: l.serials, serviceStaffId: l.serviceStaffId,
        };
      });

      if (cart.pointsRedeemed > 0) {
        const cap = isWalkIn ? 0 : maxRedeemable({ total: totals.total + totals.redeemed, balance: contact.points, s: s.rewards });
        if (cart.pointsRedeemed > cap) throw new ValidationError({ pointsRedeemed: "invalid" });
      }

      const payments: Payment[] = [];
      let paid = 0;
      let change = 0;
      if (status === "final") {
        const rows = (input.payments ?? []).filter((r) => r.amount > 0).map((r) => ({ ...r, amount: roundMoney(r.amount) }));
        const st = paymentState(totals.total, rows);
        if (st.nonCashOverpaid) throw new ValidationError({ payments: "non_cash_overpaid" });
        const mkPayment = (method: PaymentMethod, amount: number, isReturn: boolean, details: Payment["details"] = {}, note = "") => {
          const pid = uid("pay");
          const accountId = location.defaultAccounts[method] ?? null;
          payments.push({ id: pid, refNo: takeRef(d, s.prefixes.sellPayment, at), amount, method, accountId, paidOn: at, note, isReturn, details, createdBy: by });
          if (accountId) {
            d.accountTxns.push(accountTxn.parse({
              id: uid("at"), createdAt: at, createdBy: by, accountId, kind: isReturn ? "debit" : "credit", subType: "payment",
              amount, date: at, transactionId: tid, paymentId: pid,
            }));
          }
        };
        for (const r of rows) mkPayment(r.method, r.amount, false, r.details, r.note);
        if (st.change > 0) mkPayment("cash", st.change, true);
        paid = st.paid;
        change = st.change;
        const due = roundMoney(Math.max(0, totals.total - paid));
        if (due > 0 && isWalkIn) throw new AppError("Choose a named customer for a credit sale", "walk_in_credit");
        if (due > 0 && contact.creditLimit != null && customerDue(d, contact.id) + due > contact.creditLimit) throw new CreditLimitError();
      }

      let refNo: string;
      let invoiceSchemeId: string | null = null;
      if (status === "final") {
        const scheme = d.invoiceSchemes.find((x) => x.id === location.invoiceSchemeId);
        if (!scheme) throw new NotFoundError("Invoice scheme");
        refNo = nextInvoiceNo(scheme);
        scheme.count += 1;
        invoiceSchemeId = scheme.id;
      } else {
        refNo = takeRef(d, s.prefixes.draft, at);
      }

      const earned = status === "final" && !isWalkIn ? pointsEarned(totals.total, s.rewards) : 0;
      if (status === "final" && !isWalkIn) contact.points = Math.max(0, contact.points - cart.pointsRedeemed + earned);

      if (cart.resumedFromId) {
        const i = d.transactions.findIndex((t) => t.id === cart.resumedFromId && t.type === "sell" && EDITABLE.includes(t.status));
        if (i >= 0) d.transactions.splice(i, 1);
      }

      const { lines: _l, ...orderTotals } = totals;
      d.transactions.push(transaction.parse({
        id: tid, createdAt: nowISO(), createdBy: by, type: "sell", status, channel: "pos", locationId, contactId: contact.id, refNo, date: at,
        lines, discount: cart.discount, orderTaxId: cart.orderTaxId, orderTaxRate: cart.orderTaxRate,
        pointsRedeemed: status === "final" ? cart.pointsRedeemed : 0, pointsEarned: earned,
        shipping: {
          zone: cart.shipping.zone, charges: cart.shipping.charges, details: cart.shipping.details, address: cart.shipping.address,
          status: status === "final" && cart.shipping.zone ? "ordered" : null,
        },
        totals: orderTotals, payments,
        paymentStatus: status === "final" ? paymentStatus({ total: totals.total, paid, date: at, payTerm: contact.payTerm }) : "due",
        payTerm: contact.payTerm, notes: cart.note, staffNote: input.staffNote ?? "", invoiceSchemeId,
        invoiceLayoutId: cart.invoiceLayoutId, technicianId: cart.technicianId,
      }));

      result = { id: tid, refNo, status, total: totals.total, paid, change, due: roundMoney(Math.max(0, totals.total - paid)) };
    });
    return result;
  },

  async toCart(id: string): Promise<Cart> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "sell" && EDITABLE.includes(x.status));
    if (!t) throw new NotFoundError("Sale");
    const stockOf = (vid: string) => available(d.stockLots, vid, t.locationId);
    return {
      ...emptyCart(),
      contactId: t.contactId ?? WALK_IN_ID,
      discount: t.discount,
      orderTaxId: t.orderTaxId,
      orderTaxRate: t.orderTaxRate,
      shipping: { zone: t.shipping.zone, charges: t.shipping.charges, details: t.shipping.details, address: t.shipping.address },
      technicianId: t.technicianId,
      invoiceLayoutId: t.invoiceLayoutId,
      resumedFromId: t.id,
      note: t.notes,
      lines: t.lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        const v = d.variations.find((x) => x.id === l.variationId);
        const u = d.units.find((x) => x.id === l.unitId);
        return {
          key: uid("k"), productId: l.productId, variationId: l.variationId,
          name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId,
          sku: v?.sku ?? "", unitId: l.unitId, unitName: u?.shortName ?? "", allowDecimal: u?.allowDecimal ?? false,
          qty: l.qty, unitPrice: l.unitPrice, taxId: l.taxId, taxRate: l.taxRate, taxType: l.taxType, discount: l.discount,
          note: l.note, serials: l.serials, serviceStaffId: l.serviceStaffId, enableSerial: p?.enableSerial ?? false,
          maxQty: p?.manageStock ? stockOf(l.variationId) : null,
        };
      }),
    };
  },

  async list(q: { locationId: string; status: SaleStatus; limit?: number }): Promise<SaleRow[]> {
    await delay();
    const d = getDB();
    const names = new Map(d.contacts.map((c) => [c.id, c.name]));
    return d.transactions
      .filter((t) => t.type === "sell" && t.locationId === q.locationId && t.status === q.status)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, q.limit ?? 10)
      .map((t) => ({
        id: t.id, refNo: t.refNo, date: t.date, status: t.status as SaleStatus, contactName: names.get(t.contactId ?? "") ?? "",
        itemsCount: t.totals.itemsCount, total: t.totals.total, note: t.staffNote || t.notes,
      }));
  },

  async receipt(id: string): Promise<ReceiptData> {
    await delay();
    const d = getDB();
    const txn = d.transactions.find((t) => t.id === id);
    if (!txn) throw new NotFoundError("Sale");
    const location = d.locations.find((l) => l.id === txn.locationId)!;
    const layoutById = (lid: string | null) => d.invoiceLayouts.find((x) => x.id === lid);
    const layout = layoutById(txn.invoiceLayoutId) ?? layoutById(location.posLayoutId) ?? d.invoiceLayouts[0];
    const a4Layout = layoutById(location.saleLayoutId) ?? d.invoiceLayouts.find((x) => x.paper === "a4") ?? layout;
    const contact = d.contacts.find((c) => c.id === txn.contactId);
    const user = d.users.find((u) => u.id === txn.createdBy);
    const sum = paymentSummary(txn.totals.total, txn.payments);
    const change = roundMoney(txn.payments.filter((p) => p.isReturn).reduce((s, p) => s + p.amount, 0));
    return {
      txn, location, layout, a4Layout,
      businessName: d.settings.business.name,
      logo: d.settings.business.logo,
      customer: { name: contact?.name ?? "", mobile: contact?.mobile ?? "", isWalkIn: !contact || contact.isDefault },
      cashier: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      lines: txn.lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        const v = d.variations.find((x) => x.id === l.variationId);
        const discountPerUnit = l.qty ? roundMoney((l.unitPrice * l.qty * (1 + (l.taxType === "exclusive" ? l.taxRate / 100 : 0)) - l.subtotal) / l.qty) : 0;
        return {
          name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : "",
          sku: v?.sku ?? "", unitName: d.units.find((u) => u.id === l.unitId)?.shortName ?? "",
          qty: l.qty, unitPrice: l.qty ? roundMoney(l.subtotal / l.qty + discountPerUnit) : 0, discount: discountPerUnit,
          subtotal: l.subtotal, serials: l.serials,
        };
      }),
      paid: sum.paid, change, due: sum.due,
    };
  },

  async remove(id: string): Promise<void> {
    await delay();
    commit((d) => {
      const i = d.transactions.findIndex((t) => t.id === id);
      if (i < 0) throw new NotFoundError("Sale");
      if (!EDITABLE.includes(d.transactions[i].status)) throw new AppError("Final sales can't be deleted here", "not_deletable");
      d.transactions.splice(i, 1);
    });
  },
};
```


- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/data/services/sales.test.ts`
Expected: PASS (12 tests).
If `customer()` returns a contact with a `payTerm` whose due date has passed, `paymentStatus` can be `"overdue"`. It can't happen here because the sale is dated now.

- [ ] **Step 5: Commit**

```bash
git add lib/data/services/sales.ts lib/data/services/sales.test.ts
git commit -m "feat(pos): sales checkout, resume, receipt, recent lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cash register service

**Files:**
- Create: `lib/data/services/registers.ts`
- Test: `lib/data/services/registers.test.ts`

**Interfaces:**
- Produces:

```ts
export type RegisterSummary = {
  register: CashRegister;
  byMethod: { method: PaymentMethod; amount: number; count: number }[]; // incoming sell payments, sorted cash first
  opening: number; cashIn: number; change: number; refunds: number; expenses: number;
  expectedCash: number; totalSales: number; cardSlips: number; cheques: number; sellsCount: number;
};
export type CloseRegisterInput = { closingAmount: number; totalCardSlips: number; totalCheques: number; closingNote: string; denominations: Record<string, number> };
export const registersService: {
  current(locationId: string): Promise<CashRegister | null>;   // open register of the current user at the location
  open(locationId: string, openingCash: number): Promise<CashRegister>;
  summary(id: string): Promise<RegisterSummary>;
  close(id: string, input: CloseRegisterInput): Promise<CashRegister>;
};
```

**Activity rule (spec § Register):**
- A payment counts toward a register when `payment.createdBy === register.userId`, its transaction's `locationId === register.locationId`, and `openedAt ≤ paidOn ≤ (closedAt ?? now)`.
- For `sell`, a non-return payment goes into `byMethod`, and a cash `isReturn` payment adds to `change`.
- For `sell_return`, cash payments add to `refunds`. For `expense`, cash payments add to `expenses`.
- `expectedCash = opening + cashIn − change − refunds − expenses`
- `totalSales = Σ byMethod − change`

- [ ] **Step 1: Write the failing test**

```ts
// lib/data/services/registers.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart } from "@/lib/pos/cart";
import { expensesService } from "./expenses";
import { posService, toCartItem } from "./pos";
import { registersService } from "./registers";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("registersService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
    commit((d) => {
      for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    });
  });

  it("seeded closed register: expected cash matches its closing amount", async () => {
    const reg = getDB().cashRegisters.find((r) => r.userId === "user_cashier" && r.status === "close" && r.closingAmount != null && r.closedAt !== r.openedAt)!;
    const s = await registersService.summary(reg.id);
    expect(s.expectedCash).toBeCloseTo(reg.closingAmount!, 2);
    expect(s.cardSlips).toBe(reg.totalCardSlips);
  });

  it("open → one per user/location, sale and expense flow into the summary, close", async () => {
    expect(await registersService.current(LOC_RANGO)).toBeNull();
    const reg = await registersService.open(LOC_RANGO, 2000);
    expect(await registersService.current(LOC_RANGO)).toMatchObject({ id: reg.id, openingCash: 2000, status: "open" });
    await expect(registersService.open(LOC_RANGO, 100)).rejects.toMatchObject({ code: "register_open" });

    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock && !x.enableSerial && x.variations[0].stock >= 1)!;
    const cart = addItem(emptyCart(), toCartItem(p, p.variations[0]));
    const sale = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e6 }] });
    await expensesService.create({ locationId: LOC_RANGO, categoryId: getDB().expenseCategories[0].id, amount: 100, method: "cash" });

    const s = await registersService.summary(reg.id);
    expect(s.byMethod.find((m) => m.method === "cash")).toMatchObject({ amount: 1e6, count: 1 });
    expect(s).toMatchObject({ opening: 2000, change: sale.change, expenses: 100, sellsCount: 1 });
    expect(s.expectedCash).toBeCloseTo(2000 + sale.total - 100, 2);
    expect(s.totalSales).toBeCloseTo(sale.total, 2);

    const closed = await registersService.close(reg.id, { closingAmount: s.expectedCash, totalCardSlips: 0, totalCheques: 0, closingNote: "ok", denominations: { "1000": 2 } });
    expect(closed).toMatchObject({ status: "close", closingAmount: s.expectedCash, closingNote: "ok" });
    expect(closed.closedAt).not.toBeNull();
    expect(await registersService.current(LOC_RANGO)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/data/services/registers.test.ts`
Expected: FAIL (`Cannot find module './registers'`).

- [ ] **Step 3: Implement**

```ts
// lib/data/services/registers.ts
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError } from "@/lib/data/errors";
import { cashRegister, type CashRegister, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, uid } from "./_util";

export type RegisterSummary = {
  register: CashRegister;
  byMethod: { method: PaymentMethod; amount: number; count: number }[];
  opening: number;
  cashIn: number;
  change: number;
  refunds: number;
  expenses: number;
  expectedCash: number;
  totalSales: number;
  cardSlips: number;
  cheques: number;
  sellsCount: number;
};

export type CloseRegisterInput = {
  closingAmount: number;
  totalCardSlips: number;
  totalCheques: number;
  closingNote: string;
  denominations: Record<string, number>;
};

const me = () => {
  const id = currentUser()?.user.id;
  if (!id) throw new AppError("Not signed in", "unauthenticated");
  return id;
};

export const registersService = {
  async current(locationId: string): Promise<CashRegister | null> {
    await delay();
    const uid_ = currentUser()?.user.id;
    return getDB().cashRegisters.find((r) => r.userId === uid_ && r.locationId === locationId && r.status === "open") ?? null;
  },

  async open(locationId: string, openingCash: number): Promise<CashRegister> {
    await delay();
    const userId = me();
    let created!: CashRegister;
    commit((d) => {
      if (d.cashRegisters.some((r) => r.userId === userId && r.locationId === locationId && r.status === "open")) {
        throw new AppError("A register is already open", "register_open");
      }
      const at = nowISO();
      created = cashRegister.parse({
        id: uid("reg"), createdAt: at, createdBy: userId, userId, locationId, openedAt: at, closedAt: null,
        openingCash: roundMoney(Math.max(0, openingCash)), status: "open",
      });
      d.cashRegisters.push(created);
    });
    return created;
  },

  async summary(id: string): Promise<RegisterSummary> {
    await delay();
    const d = getDB();
    const register = d.cashRegisters.find((r) => r.id === id);
    if (!register) throw new NotFoundError("Cash register");
    const end = register.closedAt ?? nowISO();
    const methods = new Map<PaymentMethod, { amount: number; count: number }>();
    let change = 0;
    let refunds = 0;
    let expenses = 0;
    const sells = new Set<string>();

    for (const t of d.transactions) {
      if (t.locationId !== register.locationId) continue;
      for (const p of t.payments) {
        if (p.createdBy !== register.userId || p.paidOn < register.openedAt || p.paidOn > end) continue;
        if (t.type === "sell") {
          if (p.isReturn) {
            if (p.method === "cash") change += p.amount;
            continue;
          }
          const m = methods.get(p.method) ?? { amount: 0, count: 0 };
          methods.set(p.method, { amount: m.amount + p.amount, count: m.count + 1 });
          sells.add(t.id);
        } else if (t.type === "sell_return" && p.method === "cash") {
          refunds += p.amount;
        } else if (t.type === "expense" && p.method === "cash") {
          expenses += p.amount;
        }
      }
    }

    const byMethod = [...methods.entries()]
      .map(([method, v]) => ({ method, amount: roundMoney(v.amount), count: v.count }))
      .sort((a, b) => (a.method === "cash" ? -1 : b.method === "cash" ? 1 : b.amount - a.amount));
    const cashIn = byMethod.find((m) => m.method === "cash")?.amount ?? 0;
    const total = byMethod.reduce((s, m) => s + m.amount, 0);
    return {
      register, byMethod, opening: register.openingCash, cashIn,
      change: roundMoney(change), refunds: roundMoney(refunds), expenses: roundMoney(expenses),
      expectedCash: roundMoney(register.openingCash + cashIn - change - refunds - expenses),
      totalSales: roundMoney(total - change),
      cardSlips: methods.get("card")?.count ?? 0,
      cheques: methods.get("cheque")?.count ?? 0,
      sellsCount: sells.size,
    };
  },

  async close(id: string, input: CloseRegisterInput): Promise<CashRegister> {
    await delay();
    let closed!: CashRegister;
    commit((d) => {
      const r = d.cashRegisters.find((x) => x.id === id);
      if (!r) throw new NotFoundError("Cash register");
      if (r.status === "close") throw new AppError("Register already closed", "register_closed");
      Object.assign(r, {
        status: "close", closedAt: nowISO(), closingAmount: roundMoney(input.closingAmount),
        totalCardSlips: input.totalCardSlips, totalCheques: input.totalCheques, closingNote: input.closingNote.trim(),
        denominations: input.denominations,
      });
      closed = { ...r };
    });
    return closed;
  },
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/data/services/registers.test.ts`
Expected: PASS (2 tests).
If the first test finds no qualifying register, the seed produced no cashier POS days. That can't happen with seed 42, because the cashier appears in 2 of 3 POS picks at Rango every day.

- [ ] **Step 5: Commit**

```bash
git add lib/data/services/registers.ts lib/data/services/registers.test.ts
git commit -m "feat(pos): cash register open/summary/close

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Query hooks, cart store, dialog store, checkout action

**Files:**
- Create: `lib/data/hooks/pos.ts`, `lib/pos/store.ts`, `features/pos/dialogStore.ts`, `features/pos/usePosAction.ts`, `features/pos/focus.ts`
- Modify: `lib/data/hooks/keys.ts` (add `pos` keys)

**Interfaces:**
- Consumes: every service from Tasks 3–6.
- Produces:

```ts
// keys.ts (new entries)
keys.pos = {
  products: (q: object) => ["products", "pos", q],
  search: (q: object) => ["products", "pos-search", q],
  register: (loc: string) => ["cashRegisters", "current", loc],
  registerSummary: (id: string) => ["transactions", "register-summary", id],
  sales: (q: object) => ["transactions", "pos-sales", q],
  receipt: (id: string) => ["transactions", "receipt", id],
  customers: (term: string) => ["contacts", "pos", term],
};
// hooks/pos.ts
usePosProducts(q: PosCatalogQuery); usePosSearch(q: { locationId; contactId?; term }); usePosLookup(): (q) => Promise<PosSearchHit[]>;
useCurrentRegister(locationId); useRegisterSummary(id | undefined); usePosSales(q); useReceipt(id | undefined); usePosCustomers(term);
usePosMutations(): { checkout; remove; loadCart; openRegister; closeRegister; createExpense; createCustomer } // UseMutationResult each
// lib/pos/store.ts
useCartStore (zustand persist "posible:v1:pos-cart"); useCart(locationId): { cart: Cart; update(fn: (c: Cart) => Cart): void; replace(c: Cart): void; reset(): void }
// dialogStore.ts
export type PosDialog = "payment" | "discount" | "orderTax" | "shipping" | "points" | "suspend" | "suspended" | "recent"
  | "registerDetails" | "registerClose" | "expense" | "addCustomer" | "scale" | "shortcuts" | "receipt" | "cancel";
export type PaymentMode = "multiple" | PaymentMethod; // a method = dialog preset to that method with the full amount
usePosDialogs: { open: PosDialog | null; paymentMode: PaymentMode; receiptId: string | null;
  show(d: PosDialog): void; showPayment(mode: PaymentMode): void; showReceipt(id: string): void; hide(): void };
export const useCartFlag: { name: string | null; flag(name: string | null): void }; // zustand hook
// usePosAction.ts
export function usePosError(): (e: unknown) => void;      // maps AppError codes to toasts
export function useCheckout(locationId: string): { run(status: SaleStatus, payments?: CheckoutPayment[], staffNote?: string): Promise<boolean>; pending: boolean };
// focus.ts
export const SEARCH_ID = "pos-search"; export function focusSearch(): void;
```

- [ ] **Step 1: Add query keys**

In `lib/data/hooks/keys.ts`, add inside `keys` after `dashboard`:

```ts
  pos: {
    products: (q: object) => ["products", "pos", q] as const,
    search: (q: object) => ["products", "pos-search", q] as const,
    register: (loc: string) => ["cashRegisters", "current", loc] as const,
    registerSummary: (id: string) => ["transactions", "register-summary", id] as const,
    sales: (q: object) => ["transactions", "pos-sales", q] as const,
    receipt: (id: string) => ["transactions", "receipt", id] as const,
    customers: (term: string) => ["contacts", "pos", term] as const,
  },
```

- [ ] **Step 2: Hooks**

```ts
// lib/data/hooks/pos.ts
"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsService, type NewCustomer } from "@/lib/data/services/contacts";
import { expensesService, type NewExpense } from "@/lib/data/services/expenses";
import { posService, type PosCatalogQuery } from "@/lib/data/services/pos";
import { registersService, type CloseRegisterInput } from "@/lib/data/services/registers";
import { salesService, type CheckoutInput, type SaleStatus } from "@/lib/data/services/sales";
import { keys } from "./keys";

type SearchQuery = { locationId: string; contactId?: string; term: string };

export function usePosProducts(q: PosCatalogQuery) {
  return useQuery({ queryKey: keys.pos.products(q), queryFn: () => posService.products(q), placeholderData: keepPreviousData });
}

export function usePosSearch(q: SearchQuery) {
  return useQuery({ queryKey: keys.pos.search(q), queryFn: () => posService.search(q), enabled: q.term.trim().length > 0, placeholderData: keepPreviousData });
}

/** Imperative search for Enter/scanner input, where the deferred query may lag behind. */
export function usePosLookup() {
  const qc = useQueryClient();
  return (q: SearchQuery) => qc.fetchQuery({ queryKey: keys.pos.search(q), queryFn: () => posService.search(q) });
}

export function useCurrentRegister(locationId: string) {
  return useQuery({ queryKey: keys.pos.register(locationId), queryFn: () => registersService.current(locationId), enabled: !!locationId });
}

export function useRegisterSummary(id: string | undefined) {
  return useQuery({ queryKey: keys.pos.registerSummary(id ?? ""), queryFn: () => registersService.summary(id!), enabled: !!id });
}

export function usePosSales(q: { locationId: string; status: SaleStatus; limit?: number }, enabled = true) {
  return useQuery({ queryKey: keys.pos.sales(q), queryFn: () => salesService.list(q), enabled });
}

export function useReceipt(id: string | null | undefined) {
  return useQuery({ queryKey: keys.pos.receipt(id ?? ""), queryFn: () => salesService.receipt(id!), enabled: !!id });
}

export function usePosCustomers(term: string) {
  return useQuery({
    queryKey: keys.pos.customers(term),
    queryFn: () => contactsService.list({ type: "customer", active: "active", search: term, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
}

export function usePosMutations() {
  const qc = useQueryClient();
  // A sale touches products (stock), contacts (points/due), transactions and registers; refetch everything.
  const all = () => qc.invalidateQueries();
  return {
    checkout: useMutation({ mutationFn: (i: CheckoutInput) => salesService.checkout(i), onSuccess: all }),
    remove: useMutation({ mutationFn: (id: string) => salesService.remove(id), onSuccess: all }),
    loadCart: useMutation({ mutationFn: (id: string) => salesService.toCart(id) }),
    openRegister: useMutation({ mutationFn: (a: { locationId: string; openingCash: number }) => registersService.open(a.locationId, a.openingCash), onSuccess: all }),
    closeRegister: useMutation({ mutationFn: (a: { id: string } & CloseRegisterInput) => registersService.close(a.id, a), onSuccess: all }),
    createExpense: useMutation({ mutationFn: (i: NewExpense) => expensesService.create(i), onSuccess: all }),
    createCustomer: useMutation({ mutationFn: (i: NewCustomer) => contactsService.createCustomer(i), onSuccess: () => qc.invalidateQueries({ queryKey: keys.contacts.all }) }),
  };
}
```

- [ ] **Step 3: Cart store**

```ts
// lib/pos/store.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "@/lib/data/store/storage";
import { emptyCart, type Cart } from "./cart";

type CartState = {
  carts: Record<string, Cart>;
  update: (locationId: string, fn: (c: Cart) => Cart) => void;
  replace: (locationId: string, cart: Cart) => void;
  reset: (locationId: string) => void;
};

/** One in-progress cart per location, kept across reloads so a refresh never loses a sale. */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      update: (loc, fn) => set((s) => ({ carts: { ...s.carts, [loc]: fn(s.carts[loc] ?? emptyCart()) } })),
      replace: (loc, cart) => set((s) => ({ carts: { ...s.carts, [loc]: cart } })),
      reset: (loc) => set((s) => ({ carts: { ...s.carts, [loc]: emptyCart() } })),
    }),
    { name: "posible:v1:pos-cart", storage: safeStorage() },
  ),
);

const EMPTY = emptyCart();

export function useCart(locationId: string) {
  const cart = useCartStore((s) => s.carts[locationId]) ?? EMPTY;
  const update = useCartStore((s) => s.update);
  const replace = useCartStore((s) => s.replace);
  const reset = useCartStore((s) => s.reset);
  return {
    cart,
    update: (fn: (c: Cart) => Cart) => update(locationId, fn),
    replace: (c: Cart) => replace(locationId, c),
    reset: () => reset(locationId),
  };
}
```

- [ ] **Step 4: Dialog store**

```ts
// features/pos/dialogStore.ts
import { create } from "zustand";
import type { PaymentMethod } from "@/lib/data/schemas";

export type PosDialog =
  | "payment" | "discount" | "orderTax" | "shipping" | "points" | "suspend" | "suspended" | "recent"
  | "registerDetails" | "registerClose" | "expense" | "addCustomer" | "scale" | "shortcuts" | "receipt" | "cancel";
export type PaymentMode = "multiple" | PaymentMethod;

type State = {
  open: PosDialog | null;
  paymentMode: PaymentMode;
  receiptId: string | null;
  show: (d: PosDialog) => void;
  showPayment: (mode: PaymentMode) => void;
  showReceipt: (id: string) => void;
  hide: () => void;
};

/** Exactly one POS dialog at a time; hotkeys and buttons both go through here. */
export const usePosDialogs = create<State>()((set) => ({
  open: null,
  paymentMode: "multiple",
  receiptId: null,
  show: (open) => set({ open }),
  showPayment: (paymentMode) => set({ open: "payment", paymentMode }),
  showReceipt: (receiptId) => set({ open: "receipt", receiptId }),
  hide: () => set({ open: null }),
}));

/** Name of the cart line a checkout error pointed at (stock, serials, gone); CartRow rings and expands it. */
export const useCartFlag = create<{ name: string | null; flag: (name: string | null) => void }>()((set) => ({
  name: null,
  flag: (name) => set({ name }),
}));
```

- [ ] **Step 5: Checkout action and error mapping**

Focus helper first (every "return focus to search" in the UI goes through it):

```ts
// features/pos/focus.ts
export const SEARCH_ID = "pos-search";

/** Spec § a11y: focus returns to product search after each add, dialog close and checkout. */
export function focusSearch() {
  requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
}
```

```ts
// features/pos/usePosAction.ts
"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AppError, InsufficientStockError, ProductUnavailableError, SerialsRequiredError, ValidationError } from "@/lib/data/errors";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import type { CheckoutPayment, SaleStatus } from "@/lib/data/services/sales";
import { useCart } from "@/lib/pos/store";
import { useCartFlag, usePosDialogs } from "./dialogStore";
import { focusSearch } from "./focus";

export function usePosError() {
  const t = useTranslations();
  const flag = useCartFlag((s) => s.flag);
  return (e: unknown) => {
    if (e instanceof InsufficientStockError || e instanceof SerialsRequiredError || e instanceof ProductUnavailableError) flag(e.productName);
    if (e instanceof InsufficientStockError) return toast.error(t("errors.insufficientStock", { available: e.available, product: e.productName }));
    if (e instanceof SerialsRequiredError) return toast.error(t("pos.errors.serialsRequired", { count: e.count, product: e.productName }));
    if (e instanceof ProductUnavailableError) return toast.error(t("pos.errors.productGone", { product: e.productName }));
    if (e instanceof ValidationError) {
      if (e.fields.payments) return toast.error(t("pos.pay.nonCashOverpaid"));
      if (e.fields.pointsRedeemed) return toast.error(t("pos.errors.pointsInvalid"));
    }
    if (e instanceof AppError) {
      const byCode: Record<string, string> = {
        walk_in_credit: "pos.errors.walkInCredit",
        credit_limit: "errors.creditLimit",
        empty_cart: "pos.errors.emptyCart",
        not_deletable: "pos.errors.notDeletable",
        register_open: "pos.errors.registerOpen",
      };
      if (byCode[e.code]) return toast.error(t(byCode[e.code]));
    }
    toast.error(t("errors.generic"));
  };
}

/**
 * Checkout + the follow-up every entry point shares: clear the cart, toast, then the receipt modal
 * for final sales (and suspended ones when `printOnSuspend`). Other statuses get a Print toast action.
 */
export function useCheckout(locationId: string) {
  const t = useTranslations();
  const { cart, reset } = useCart(locationId);
  const { checkout } = usePosMutations();
  const { data: settings } = useSettings();
  const onError = usePosError();
  const { hide, showReceipt } = usePosDialogs();

  const run = async (status: SaleStatus, payments: CheckoutPayment[] = [], staffNote?: string) => {
    try {
      const res = await checkout.mutateAsync({ cart, locationId, status, payments, staffNote });
      reset();
      useCartFlag.getState().flag(null);
      const msg = t(`pos.done.${status}`, { ref: res.refNo });
      if (status === "final" || (status === "suspended" && settings?.pos.printOnSuspend)) {
        toast.success(msg);
        showReceipt(res.id);
      } else {
        toast.success(msg, { action: { label: t("common.print"), onClick: () => showReceipt(res.id) } });
        hide();
      }
      focusSearch();
      return true;
    } catch (e) {
      onError(e);
      return false;
    }
  };
  return { run, pending: checkout.isPending };
}
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

```bash
git add lib/data/hooks/keys.ts lib/data/hooks/pos.ts lib/pos/store.ts features/pos/dialogStore.ts features/pos/usePosAction.ts features/pos/focus.ts
git commit -m "feat(pos): query hooks, persisted cart store, dialog store, checkout action

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Screen shell — layout, top bar, register gate, narrow notice

**Files:**
- Create: `features/pos/usePos.ts`, `features/pos/PosScreen.tsx`, `features/pos/TopBar.tsx`, `features/pos/Narrow.tsx`, `features/pos/dialogs/RegisterGate.tsx`
- Modify: `app/(pos)/pos/page.tsx` (replace the placeholder)

**Interfaces:**
- Consumes:
  - `useCurrentRegister`, `usePosSales`, `usePosMutations` (Task 7)
  - `usePosDialogs`, `usePosError`, `focusSearch` (Task 7)
  - `toCartItem`, `PosProduct`, `PosVariation` (Task 3)
  - `addItem`, `exceedsStock` (Task 1), `cartTotals` (Task 2)
- Produces:

```ts
// features/pos/usePos.ts
export function usePosLocation(): { location: Location | undefined; allowed: Location[] };
export function usePosTotals(locationId: string): CartTotals | null;          // null until settings load
export const useFlash: UseBoundStore<{ key: string | null; flash(key: string): void }>;
export function useAddToCart(locationId: string): (p: PosProduct, v: PosVariation, qty?: number) => boolean;
// PosScreen.tsx
export function PosScreen(): JSX.Element;
// Slots later tasks fill, as literal JSX comments inside PosScreen:
//   {/* slot:cart */}  {/* slot:grid */}  {/* slot:actions */}  {/* slot:dialogs */}
```

The POS has no "All locations" mode. When the global `useUI.locationId` is `"all"` or a location the user can't use, `usePosLocation` falls back to the first allowed location. The top-bar select writes back through `useUI.setLocationId`.

- [ ] **Step 1: Shared POS hooks**

```ts
// features/pos/usePos.ts
"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { create } from "zustand";
import { useCurrentUser } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { toCartItem, type PosProduct, type PosVariation } from "@/lib/data/services/pos";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { addItem, exceedsStock } from "@/lib/pos/cart";
import { cartTotals } from "@/lib/pos/selectors";
import { useCart } from "@/lib/pos/store";

/** The till's location: the global switcher's pick when usable here, else the user's first location. */
export function usePosLocation() {
  const { data } = useLookups();
  const user = useCurrentUser()?.user;
  const selected = useUI((s) => s.locationId);
  const allowed = (data?.locations ?? []).filter(
    (l) => l.active && (!user?.locationIds.length || user.locationIds.includes(l.id)),
  );
  return { location: allowed.find((l) => l.id === selected) ?? allowed[0], allowed };
}

export function usePosTotals(locationId: string) {
  const { cart } = useCart(locationId);
  const { data: settings } = useSettings();
  return settings ? cartTotals(cart, { rounding: settings.sale.roundingMethod, rewards: settings.rewards }) : null;
}

/** The line that was just added or bumped; CartRow flashes it and scrolls it into view. */
export const useFlash = create<{ key: string | null; flash: (key: string) => void }>()((set) => ({
  key: null,
  flash: (key) => set({ key }),
}));

/** Adds a product to the cart, refusing (with a toast) when it would oversell managed stock. */
export function useAddToCart(locationId: string) {
  const t = useTranslations();
  const f = useFormat();
  const { cart, update } = useCart(locationId);
  const { data: settings } = useSettings();
  const flash = useFlash((s) => s.flash);

  return (p: PosProduct, v: PosVariation, qty = 1) => {
    const item = toCartItem(p, v, qty);
    const next = addItem(cart, item, settings?.sale.itemAdditionMethod ?? "increase_qty");
    // addItem returns a new object for the touched line, so the changed line is the one not in the old cart.
    const line = next.lines.find((l) => !cart.lines.includes(l))!;
    if (!settings?.sale.allowOverselling && exceedsStock(line)) {
      toast.error(t("errors.insufficientStock", { available: f.qty(v.stock), product: item.name }));
      return false;
    }
    update(() => next);
    flash(line.key);
    return true;
  };
}
```

- [ ] **Step 2: Narrow-screen notice**

```tsx
// features/pos/Narrow.tsx
"use client";

import Link from "next/link";
import { MonitorIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

/** Below 1024px the POS layout doesn't fit; say so instead of rendering a broken screen. */
export function Narrow() {
  const t = useTranslations();
  return (
    <div className="grid min-h-dvh place-items-center p-6 lg:hidden">
      <EmptyState
        icon={MonitorIcon}
        title={t("pos.narrow")}
        action={
          <Button variant="outline" asChild>
            <Link href="/home">{t("common.back")}</Link>
          </Button>
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Register gate**

```tsx
// features/pos/dialogs/RegisterGate.tsx
"use client";

import { useState, type FormEvent } from "react";
import { LockOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/lib/auth/useCan";
import type { Location } from "@/lib/data/schemas";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

/** The POS stays locked until this user opens a register at this location. */
export function RegisterGate({ location }: { location: Location }) {
  const t = useTranslations("pos.register");
  const user = useCurrentUser()?.user;
  const { openRegister } = usePosMutations();
  const onError = usePosError();
  const [cash, setCash] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await openRegister.mutateAsync({ locationId: location.id, openingCash: Math.max(0, Number(cash) || 0) });
      toast.success(t("opened"));
      focusSearch();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="grid flex-1 place-items-center p-6">
      <Card className="w-full max-w-sm">
        <form onSubmit={submit}>
          <CardHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <LockOpenIcon className="size-5" />
            </span>
            <CardTitle>{t("openTitle")}</CardTitle>
            <CardDescription>{t("openBody", { location: location.name })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 py-4">
            <Label htmlFor="opening-cash">{t("openingCash")}</Label>
            <Input
              id="opening-cash"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              autoFocus
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="h-11 text-lg tabular-nums"
            />
            {user && <p className="text-xs text-muted-foreground">{`${user.firstName} ${user.lastName}`.trim()}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" size="lg" className="w-full" disabled={openRegister.isPending}>
              {t("open")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Top bar**

```tsx
// features/pos/TopBar.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon, ClockIcon, HistoryIcon, KeyboardIcon, LockIcon, MapPinIcon, PauseCircleIcon, ReceiptIcon,
  Undo2Icon, WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator } from "@/components/layout/Calculator";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { LogoMark } from "@/components/layout/LogoMark";
import { ProfitPopover } from "@/components/layout/ProfitPopover";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useCan } from "@/lib/auth/useCan";
import type { CashRegister, Location } from "@/lib/data/schemas";
import { usePosSales } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { usePosDialogs } from "./dialogStore";

function Clock() {
  const f = useFormat();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums" suppressHydrationWarning>
      <ClockIcon className="size-4" />
      {f.dateTime(now)}
    </span>
  );
}

function IconAction({ label, onClick, disabled, badge, children }: {
  label: string; onClick?: () => void; disabled?: boolean; badge?: number; children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled} className="relative">
          {children}
          {!!badge && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {badge}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ location, allowed, register }: {
  location: Location | undefined; allowed: Location[]; register: CashRegister | null;
}) {
  const t = useTranslations();
  const can = useCan();
  const { data: settings } = useSettings();
  const setLocationId = useUI((s) => s.setLocationId);
  const show = usePosDialogs((s) => s.show);
  const suspended = usePosSales({ locationId: location?.id ?? "", status: "suspended", limit: 50 }, !!location && !!register);
  const locked = !register;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3">
      <Button variant="ghost" size="icon" asChild aria-label={t("common.back")}>
        <Link href="/home">
          <ArrowLeftIcon />
        </Link>
      </Button>
      <LogoMark />
      <Select value={location?.id ?? ""} onValueChange={setLocationId}>
        <SelectTrigger className="w-52" aria-label={t("pos.top.location")}>
          <MapPinIcon className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {allowed.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Clock />
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => show("shortcuts")}>
        <KeyboardIcon />
        {t("pos.top.shortcuts")}
        <kbd className="rounded border bg-muted px-1 text-[10px]">?</kbd>
      </Button>

      <div className="ml-auto flex items-center gap-0.5">
        {!settings?.pos.disableSuspend && (
          <IconAction label={t("pos.top.suspended")} onClick={() => show("suspended")} disabled={locked} badge={suspended.data?.length}>
            <PauseCircleIcon />
          </IconAction>
        )}
        {!settings?.pos.hideRecentTransactions && (
          <IconAction label={t("pos.top.recent")} onClick={() => show("recent")} disabled={locked}>
            <HistoryIcon />
          </IconAction>
        )}
        {can("expense.create") && (
          <IconAction label={t("pos.top.addExpense")} onClick={() => show("expense")} disabled={locked}>
            <WalletIcon />
          </IconAction>
        )}
        <IconAction label={t("pos.top.registerDetails")} onClick={() => show("registerDetails")} disabled={locked}>
          <ReceiptIcon />
        </IconAction>
        {can("cash_register.close") && (
          <IconAction label={t("pos.top.closeRegister")} onClick={() => show("registerClose")} disabled={locked}>
            <LockIcon />
          </IconAction>
        )}
        <Calculator />
        <ProfitPopover />
        {can("sell_return.view") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild aria-label={t("pos.top.sellReturn")}>
                <Link href="/sales/returns/new">
                  <Undo2Icon />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("pos.top.sellReturn")}</TooltipContent>
          </Tooltip>
        )}
        <LocaleToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Screen**

```tsx
// features/pos/PosScreen.tsx
"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentRegister } from "@/lib/data/hooks/pos";
import { RegisterGate } from "./dialogs/RegisterGate";
import { Narrow } from "./Narrow";
import { TopBar } from "./TopBar";
import { usePosLocation } from "./usePos";

export function PosScreen() {
  const t = useTranslations("pos");
  const { location, allowed } = usePosLocation();
  const register = useCurrentRegister(location?.id ?? "");
  const ready = !!location && !!register.data;

  return (
    <>
      <Narrow />
      <div className="hidden h-dvh flex-col overflow-hidden bg-muted/30 lg:flex" data-print-hide>
        <TopBar location={location} allowed={allowed} register={register.data ?? null} />
        {!location || register.isPending ? (
          <div className="flex flex-1 gap-4 p-4">
            <Skeleton className="w-[44%]" />
            <Skeleton className="flex-1" />
          </div>
        ) : !register.data ? (
          <RegisterGate location={location} />
        ) : (
          <>
            <div className="flex min-h-0 flex-1">
              <section aria-label={t("cart.caption")} className="flex w-[44%] min-w-[440px] flex-col border-r bg-card">
                {/* slot:cart */}
              </section>
              <section className="flex min-w-0 flex-1 flex-col">
                {/* slot:grid */}
              </section>
            </div>
            {/* slot:actions */}
          </>
        )}
      </div>
      {ready && (
        <>
          {/* slot:dialogs */}
        </>
      )}
    </>
  );
}
```

> Later tasks replace a `{/* slot:… */}` comment with components and add the matching imports. **Keep the slot comment** after the inserted JSX so the next task can find it. Each slot sits in scope of `location` (narrowed by `ready`), and `location.id` is the location id.

`ready &&` does not narrow `location` for TypeScript, so the dialogs slot uses `location!`. It sits inside `ready`, which guarantees it.

- [ ] **Step 6: Page**

Replace `app/(pos)/pos/page.tsx` with:

```tsx
"use client";

import { RequirePermission } from "@/components/shared/Can";
import { PosScreen } from "@/features/pos/PosScreen";

export default function PosPage() {
  return (
    <RequirePermission permission="pos.access">
      <PosScreen />
    </RequirePermission>
  );
}
```

- [ ] **Step 7: Verify in the browser**

```bash
npm run typecheck && npm run lint
npx next dev -p 3100
```

Log in as admin/112233 and open `/pos` at 1280px. Expected:
- The "Open cash register" card shows the location name.
- Opening with 500 shows the empty two-pane layout, and the top bar icons become enabled.
- Reloading keeps the register open.
- At 900px width the narrow notice shows instead.

- [ ] **Step 8: Commit**

```bash
git add features/pos/usePos.ts features/pos/PosScreen.tsx features/pos/TopBar.tsx features/pos/Narrow.tsx features/pos/dialogs/RegisterGate.tsx "app/(pos)/pos/page.tsx"
git commit -m "feat(pos): screen shell, top bar, register gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cart pane — customer, search, meta row, cart table, totals

**Files:**
- Create: `features/pos/cart/CustomerPicker.tsx`, `features/pos/dialogs/AddCustomer.tsx`, `features/pos/cart/ProductSearch.tsx`, `features/pos/cart/MetaRow.tsx`, `features/pos/cart/CartTable.tsx`, `features/pos/cart/CartRow.tsx`, `features/pos/cart/CartTotals.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:cart`, `slot:dialogs`)

**Interfaces:**
- Consumes:
  - `usePosCustomers`, `usePosSearch`, `usePosLookup`, `usePosMutations` (Task 7)
  - `useContact` (existing, `lib/data/hooks/contacts.ts`; returns a `ContactRow` with `due`)
  - `usePosTotals`, `useAddToCart`, `useFlash` (Task 8); `useCartFlag` (Task 7)
  - `parseScaleBarcode` (Task 2)
  - Cart ops (Task 1)
- Produces:
  - `CustomerPicker({ locationId })`, `AddCustomerDialog({ locationId })`, `ProductSearch({ locationId })`
  - `MetaRow({ locationId })`, `CartTable({ locationId })`, `CartTotals({ locationId })`
  - `CartRow` quantity input ids are `pos-qty-${line.key}`. Task 16's "recent product qty" hotkey focuses them.

- [ ] **Step 1: Customer picker**

```tsx
// features/pos/cart/CustomerPicker.tsx
"use client";

import { useDeferredValue, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCan } from "@/lib/auth/useCan";
import { useContact } from "@/lib/data/hooks/contacts";
import { usePosCustomers } from "@/lib/data/hooks/pos";
import { useFormat } from "@/lib/i18n/format";
import { setContact } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

export function CustomerPicker({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { cart, update } = useCart(locationId);
  const show = usePosDialogs((s) => s.show);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const list = usePosCustomers(useDeferredValue(term));
  const { data: current } = useContact(cart.contactId);

  const pick = (id: string) => {
    update((c) => setContact(c, id));
    setOpen(false);
    setTerm("");
    focusSearch();
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} aria-label={t("pos.customer.label")} className="h-10 flex-1 justify-between">
            <span className="flex min-w-0 items-center gap-2">
              <UserIcon className="text-muted-foreground" />
              <span className="truncate">{current?.name ?? "…"}</span>
              {current && !current.isDefault && (
                <span className="truncate text-xs text-muted-foreground">{current.mobile}</span>
              )}
            </span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("pos.customer.search")} value={term} onValueChange={setTerm} />
            <CommandList>
              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
              <CommandGroup>
                {(list.data?.rows ?? []).map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => pick(c.id)}>
                    <CheckIcon className={cn(c.id === cart.contactId ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">
                      {c.name} <span className="text-muted-foreground">· {c.mobile} · {c.code}</span>
                    </span>
                    {c.due > 0 && <span className="text-xs text-danger tabular-nums">{f.money(c.due)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {current && !current.isDefault && (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
          {current.due > 0 && <Badge variant="destructive">{t("pos.customer.due", { amount: f.money(current.due) })}</Badge>}
          {current.points > 0 && <Badge variant="secondary">{t("pos.customer.points", { points: f.number(current.points) })}</Badge>}
        </div>
      )}
      {can("contacts.customer") && (
        <Button variant="outline" size="icon-lg" aria-label={t("pos.customer.add")} onClick={() => show("addCustomer")}>
          <UserPlusIcon />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add-customer dialog**

```tsx
// features/pos/dialogs/AddCustomer.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ValidationError } from "@/lib/data/errors";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { setContact } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

function AddCustomerForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { createCustomer } = usePosMutations();
  const { update } = useCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const onError = usePosError();
  const [form, setForm] = useState({ name: "", mobile: "", customerGroupId: "none", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const c = await createCustomer.mutateAsync({
        name: form.name, mobile: form.mobile, address: form.address,
        customerGroupId: form.customerGroupId === "none" ? null : form.customerGroupId,
      });
      update((cart) => setContact(cart, c.id));
      toast.success(t("pos.customer.added"));
      hide();
      focusSearch();
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      else onError(err);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.customer.add")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="nc-name">{t("pos.customer.name")}</Label>
        <Input id="nc-name" autoFocus value={form.name} onChange={(e) => set("name")(e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-destructive">{t("errors.required")}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="nc-mobile">{t("pos.customer.mobile")}</Label>
        <Input id="nc-mobile" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} aria-invalid={!!errors.mobile} />
        {errors.mobile && <p className="text-xs text-destructive">{t("errors.required")}</p>}
      </div>
      <div className="grid gap-2">
        <Label>{t("pos.customer.group")}</Label>
        <Select value={form.customerGroupId} onValueChange={set("customerGroupId")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.none")}</SelectItem>
            {lookups?.customerGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="nc-address">{t("pos.customer.address")}</Label>
        <Textarea id="nc-address" rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={createCustomer.isPending}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddCustomerDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "addCustomer");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-md">{open && <AddCustomerForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

> The `ValidationError.fields` keys for `createCustomer` are `name` and `mobile` (Task 4). A duplicate mobile uses the value `"taken"`. Show `errors.required` for both; the duplicate case is rare enough in a POS quick-add.

**Dialog pattern used by every POS dialog from here on:** a `…Dialog` wrapper subscribes to `usePosDialogs`, and it mounts the inner `…Form` only while open. The form's `useState` initialisers then read fresh cart/settings values each time it opens, with no effects.

- [ ] **Step 3: Product search**

```tsx
// features/pos/cart/ProductSearch.tsx
"use client";

import { useDeferredValue, useState, type KeyboardEvent } from "react";
import { PlusIcon, ScanBarcodeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/lib/auth/useCan";
import { usePosLookup, usePosSearch } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PosSearchHit } from "@/lib/data/services/pos";
import { useFormat } from "@/lib/i18n/format";
import { parseScaleBarcode } from "@/lib/pos/scale";
import { useCart } from "@/lib/pos/store";
import { SEARCH_ID } from "../focus";
import { useAddToCart } from "../usePos";

export function ProductSearch({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { cart } = useCart(locationId);
  const { data: settings } = useSettings();
  const add = useAddToCart(locationId);
  const lookup = usePosLookup();
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(term);
  const hideSuggestions = settings?.pos.hideProductSuggestion;
  const { data: hits = [] } = usePosSearch({ locationId, contactId: cart.contactId, term: hideSuggestions ? "" : deferred });
  const open = term.trim().length > 0 && hits.length > 0 && deferred === term;

  const choose = (hit: PosSearchHit, qty = 1) => {
    if (add(hit.product, hit.variation, qty)) {
      setTerm("");
      setActive(0);
    }
  };

  /** Enter: a highlighted suggestion wins; otherwise treat the text as a scan (scale label, then SKU). */
  const submit = async () => {
    const raw = term.trim();
    if (!raw) return;
    if (open && hits[active]) return choose(hits[active]);
    const scale = settings?.pos.enableWeighingScale ? parseScaleBarcode(raw, settings.pos.weighingScale) : null;
    const res = await lookup({ locationId, contactId: cart.contactId, term: scale?.sku ?? raw });
    const hit = res.find((h) => h.exact) ?? (res.length === 1 ? res[0] : undefined);
    if (hit) return choose(hit, scale?.qty ?? 1);
    toast.error(t("pos.search.noMatch", { term: raw }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape" && term) {
      e.preventDefault();
      setTerm("");
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <ScanBarcodeIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={SEARCH_ID}
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="pos-search-list"
          aria-activedescendant={open ? `pos-hit-${active}` : undefined}
          placeholder={t("pos.search.placeholder")}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-11 pl-10 text-base"
        />
        {open && (
          <ul id="pos-search-list" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
            {hits.map((h, i) => (
              <li
                key={h.variation.id}
                id={`pos-hit-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm", i === active && "bg-accent")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {h.product.name}
                    {h.product.type === "variable" && <span className="text-muted-foreground"> · {h.variation.name}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{h.variation.sku}</span>
                </span>
                {settings?.pos.showPricingOnSuggestion !== false && (
                  <span className="tabular-nums">{f.money(h.variation.priceInc)}</span>
                )}
                {h.product.manageStock && (
                  <span className={cn("w-20 text-right text-xs tabular-nums", h.variation.stock <= 0 ? "text-danger" : "text-muted-foreground")}>
                    {t("pos.search.inStock", { qty: f.qty(h.variation.stock) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {can("product.create") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-lg" aria-label={t("pos.search.addProduct")} onClick={() => window.open("/products/new", "_blank")}>
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("pos.search.addProduct")}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
```

> Scanners type fast and end with Enter. By then `deferred` may lag behind `term`, so `open` is false and Enter goes through the imperative `lookup`. That is why `open` requires `deferred === term`.

- [ ] **Step 4: Meta row**

```tsx
// features/pos/cart/MetaRow.tsx
"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";

const NONE = "none";

export function MetaRow({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.meta");
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { cart, update } = useCart(locationId);
  const technicians = lookups?.technicians ?? [];
  const layouts = lookups?.invoiceLayouts ?? [];
  const showLayout = settings?.pos.showInvoiceLayout;
  const showDate = settings?.pos.enableTransactionDate;
  if (!technicians.length && !showLayout && !showDate) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {technicians.length > 0 && (
        <Select value={cart.technicianId ?? NONE} onValueChange={(v) => update((c) => patchCart(c, { technicianId: v === NONE ? null : v }))}>
          <SelectTrigger size="sm" className="w-full" aria-label={t("technician")}>
            <SelectValue placeholder={t("technician")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{`${t("technician")}: ${t("none")}`}</SelectItem>
            {technicians.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showLayout && (
        <Select value={cart.invoiceLayoutId ?? NONE} onValueChange={(v) => update((c) => patchCart(c, { invoiceLayoutId: v === NONE ? null : v }))}>
          <SelectTrigger size="sm" className="w-full" aria-label={t("layout")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{`${t("layout")}: ${t("none")}`}</SelectItem>
            {layouts.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showDate && (
        <Input
          type="datetime-local"
          aria-label={t("date")}
          className="h-7 text-xs"
          value={cart.date ? format(new Date(cart.date), "yyyy-MM-dd'T'HH:mm") : ""}
          onChange={(e) => update((c) => patchCart(c, { date: e.target.value ? new Date(e.target.value).toISOString() : null }))}
        />
      )}
    </div>
  );
}
```

> `datetime-local` works in local time and `cart.date` is ISO UTC, hence the `date-fns` `format` round trip.

- [ ] **Step 5: Cart row**

```tsx
// features/pos/cart/CartRow.tsx
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDownIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import type { LineTotals } from "@/lib/domain/totals";
import { useFormat } from "@/lib/i18n/format";
import {
  exceedsStock, removeLine, setLineDiscount, setLineNote, setPrice, setQty, setSerials, setServiceStaff, type CartLine,
} from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { useCartFlag } from "../dialogStore";
import { focusSearch } from "../focus";
import { useFlash } from "../usePos";

type Props = { locationId: string; line: CartLine; index: number; totals: LineTotals; expanded: boolean; onToggle: () => void };

export function CartRow({ locationId, line, index, totals, expanded, onToggle }: Props) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: settings } = useSettings();
  const { data: lookups } = useLookups();
  const { update } = useCart(locationId);
  const flashKey = useFlash((s) => s.key);
  const ref = useRef<HTMLTableRowElement>(null);
  const [serial, setSerial] = useState("");
  const flagged = useCartFlag((s) => s.name === line.name);
  const flashing = flashKey === line.key;
  const over = exceedsStock(line) || flagged;
  const needsSerials = line.enableSerial && line.serials.length !== line.qty;
  const open = expanded || needsSerials || flagged;
  const step = line.allowDecimal ? 0.1 : 1;
  const oversell = !!settings?.sale.allowOverselling;
  const serviceStaff = settings?.modules.serviceStaff && settings.pos.inlineServiceStaff
    ? (lookups?.users ?? []).filter((u) => lookups?.roles.find((r) => r.id === u.roleId)?.isServiceStaff)
    : [];

  useEffect(() => {
    if (flashing) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flashing]);

  const changeQty = (q: number) => {
    if (!oversell && exceedsStock(line, q)) {
      toast.error(t("errors.insufficientStock", { available: f.qty(line.maxQty ?? 0), product: line.name }));
      return;
    }
    update((c) => setQty(c, line.key, q));
  };

  const addSerial = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = serial.trim();
    if (v && !line.serials.includes(v)) update((c) => setSerials(c, line.key, [...line.serials, v]));
    setSerial("");
  };

  return (
    <>
      <tr
        ref={ref}
        className={cn(
          "border-b align-middle transition-colors",
          flashing && "animate-[pos-flash_1s_ease-out]",
          over && "bg-danger/5 ring-1 ring-danger ring-inset",
        )}
      >
        <td className="w-8 py-2 pl-3 text-xs text-muted-foreground tabular-nums">{f.number(index + 1)}</td>
        <td className="py-2 pr-2">
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-1 text-left">
            <ChevronDownIcon className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-medium">{line.name}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {line.sku}
                {line.maxQty !== null && (
                  <span className={cn(over && "font-medium text-danger")}>· {t("pos.cart.stockLeft", { qty: f.qty(line.maxQty) })}</span>
                )}
                {needsSerials && <Badge variant="outline" className="h-4 px-1 text-[10px]">{t("pos.cart.serials")}</Badge>}
                {line.discount && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{t("pos.cart.discount")}</Badge>}
              </span>
            </span>
          </button>
        </td>
        <td className="py-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={t("pos.cart.decrease")} onClick={() => changeQty(line.qty - step)} disabled={line.qty <= step}>
              <MinusIcon />
            </Button>
            <Input
              id={`pos-qty-${line.key}`}
              type="number"
              inputMode="decimal"
              min={step}
              step={line.allowDecimal ? "any" : 1}
              aria-label={`${t("pos.cart.qty")} ${line.name}`}
              value={line.qty}
              onChange={(e) => changeQty(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && focusSearch()}
              className="h-8 w-16 px-1 text-center tabular-nums"
            />
            <Button variant="outline" size="icon-sm" aria-label={t("pos.cart.increase")} onClick={() => changeQty(line.qty + step)}>
              <PlusIcon />
            </Button>
          </div>
          <span className="mt-0.5 block text-center text-[10px] text-muted-foreground">{line.unitName}</span>
        </td>
        <td className="py-2 text-right tabular-nums">
          {settings?.pos.subtotalEditable && can("pos.edit_price") ? (
            <Input
              type="number"
              min={0}
              step="any"
              aria-label={`${t("pos.cart.price")} ${line.name}`}
              value={line.unitPrice}
              onChange={(e) => update((c) => setPrice(c, line.key, Number(e.target.value)))}
              className="ml-auto h-8 w-24 text-right tabular-nums"
            />
          ) : (
            <span className="text-sm">{f.amount(totals.netUnitInc)}</span>
          )}
        </td>
        <td className="py-2 pr-2 text-right text-sm font-medium tabular-nums">{f.amount(totals.subtotal)}</td>
        <td className="w-10 py-2 pr-2">
          <Button variant="ghost" size="icon-sm" aria-label={t("pos.cart.remove", { name: line.name })} onClick={() => update((c) => removeLine(c, line.key))}>
            <XIcon />
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-muted/40">
          <td />
          <td colSpan={5} className="py-3 pr-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="grid gap-1">
                <Label className="text-xs">{t("pos.cart.unitPrice")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!can("pos.edit_price")}
                  value={line.unitPrice}
                  onChange={(e) => update((c) => setPrice(c, line.key, Number(e.target.value)))}
                  className="h-8 tabular-nums"
                />
                {line.taxRate > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {`${f.percent(line.taxRate)} · ${line.taxType === "inclusive" ? "inc." : "exc."} · ${f.amount(totals.unitTax)}`}
                  </span>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("pos.cart.discount")}</Label>
                <div className="flex gap-1">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    disabled={!can("pos.edit_discount")}
                    value={line.discount?.type ?? "fixed"}
                    onValueChange={(v) => v && update((c) => setLineDiscount(c, line.key, { type: v as "fixed" | "percentage", amount: line.discount?.amount ?? 0 }))}
                  >
                    <ToggleGroupItem value="fixed" aria-label={t("pos.discount.fixed")}>৳</ToggleGroupItem>
                    <ToggleGroupItem value="percentage" aria-label={t("pos.discount.percentage")}>%</ToggleGroupItem>
                  </ToggleGroup>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    disabled={!can("pos.edit_discount")}
                    value={line.discount?.amount ?? ""}
                    onChange={(e) => {
                      const amount = Number(e.target.value);
                      update((c) => setLineDiscount(c, line.key, amount > 0 ? { type: line.discount?.type ?? "fixed", amount } : null));
                    }}
                    className="h-8 tabular-nums"
                  />
                </div>
              </div>
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs">{t("pos.cart.note")}</Label>
                <Input value={line.note} onChange={(e) => update((c) => setLineNote(c, line.key, e.target.value))} className="h-8" />
              </div>
              {line.enableSerial && (
                <div className="col-span-2 grid gap-1">
                  <Label className="text-xs" htmlFor={`serial-${line.key}`}>
                    {`${t("pos.cart.serials")} (${f.number(line.serials.length)}/${f.qty(line.qty)})`}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {line.serials.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-1">
                        {s}
                        <button type="button" aria-label={t("common.remove")} onClick={() => update((c) => setSerials(c, line.key, line.serials.filter((x) => x !== s)))}>
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    id={`serial-${line.key}`}
                    autoFocus={needsSerials}
                    placeholder={t("pos.cart.serialsHint")}
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    onKeyDown={addSerial}
                    className="h-8"
                  />
                </div>
              )}
              {serviceStaff.length > 0 && (
                <div className="col-span-2 grid gap-1">
                  <Label className="text-xs">{t("pos.cart.serviceStaff")}</Label>
                  <Select value={line.serviceStaffId ?? "none"} onValueChange={(v) => update((c) => setServiceStaff(c, line.key, v === "none" ? null : v))}>
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("common.none")}</SelectItem>
                      {serviceStaff.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.firstName} ${u.lastName}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

> `settings.modules.serviceStaff` exists in the settings schema. The currency glyph `৳` in the fixed-discount toggle is a symbol, not a translatable word; if the linter flags literal strings, use `settings.business.currencySymbol` instead.

Add the flash keyframes to `app/globals.css` (after the theme blocks):

```css
@keyframes pos-flash {
  from { background-color: color-mix(in oklab, var(--primary) 18%, transparent); }
  to { background-color: transparent; }
}
```

- [ ] **Step 6: Cart table**

```tsx
// features/pos/cart/CartTable.tsx
"use client";

import { useState } from "react";
import { ScanBarcodeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/lib/pos/store";
import { usePosTotals } from "../usePos";
import { CartRow } from "./CartRow";

export function CartTable({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.cart");
  const { cart } = useCart(locationId);
  const totals = usePosTotals(locationId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!cart.lines.length) {
    return <EmptyState icon={ScanBarcodeIcon} title={t("empty")} description={t("emptyHint")} className="flex-1" />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-2 pl-3 text-left font-medium">#</th>
            <th scope="col" className="py-2 text-left font-medium">{t("product")}</th>
            <th scope="col" className="py-2 text-left font-medium">{t("qty")}</th>
            <th scope="col" className="py-2 text-right font-medium">{t("price")}</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">{t("subtotal")}</th>
            <th scope="col"><span className="sr-only">{t("remove", { name: "" })}</span></th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((l, i) => (
            <CartRow
              key={l.key}
              locationId={locationId}
              line={l}
              index={i}
              totals={totals?.lines[i] ?? { unitExc: 0, unitInc: 0, unitTax: 0, discountPerUnit: 0, netUnitInc: 0, subtotal: 0, tax: 0 }}
              expanded={expanded === l.key}
              onToggle={() => setExpanded((k) => (k === l.key ? null : l.key))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Totals footer**

```tsx
// features/pos/cart/CartTotals.tsx
"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { WALK_IN_ID } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs, type PosDialog } from "../dialogStore";
import { usePosTotals } from "../usePos";

export function CartTotals({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.totals");
  const f = useFormat();
  const { cart } = useCart(locationId);
  const totals = usePosTotals(locationId);
  const { data: settings } = useSettings();
  const show = usePosDialogs((s) => s.show);
  if (!totals || !settings) return null;

  const edit = (what: string, dialog: PosDialog) => (
    <Button variant="ghost" size="icon-xs" aria-label={t("edit", { what })} onClick={() => show(dialog)} disabled={!cart.lines.length}>
      <PencilIcon />
    </Button>
  );
  const cell = (label: string, value: string, action?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        {action}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t bg-muted/30 px-4 py-3 text-sm">
      {cell(t("items"), f.qty(totals.itemsCount))}
      {cell(t("subtotal"), f.money(totals.linesTotal))}
      {!settings.pos.disableDiscount && cell(t("discount"), `(-) ${f.money(totals.discount)}`, edit(t("discount"), "discount"))}
      {!settings.pos.disableOrderTax && cell(t("orderTax"), `(+) ${f.money(totals.orderTax)}`, edit(t("orderTax"), "orderTax"))}
      {cell(t("shipping"), `(+) ${f.money(totals.shipping)}`, edit(t("shipping"), "shipping"))}
      {settings.rewards.enabled && cart.contactId !== WALK_IN_ID &&
        cell(t("redeemed"), `(-) ${f.money(totals.redeemed)}`, edit(settings.rewards.displayName || t("redeemed"), "points"))}
      {totals.roundOff !== 0 && cell(t("roundOff"), f.money(totals.roundOff))}
    </dl>
  );
}
```

- [ ] **Step 8: Fill the slots**

In `features/pos/PosScreen.tsx`, add the imports:

```tsx
import { CartTable } from "./cart/CartTable";
import { CartTotals } from "./cart/CartTotals";
import { CustomerPicker } from "./cart/CustomerPicker";
import { MetaRow } from "./cart/MetaRow";
import { ProductSearch } from "./cart/ProductSearch";
import { AddCustomerDialog } from "./dialogs/AddCustomer";
```

Replace `{/* slot:cart */}` with:

```tsx
                <div className="grid gap-2 border-b p-3">
                  <CustomerPicker locationId={location.id} />
                  <ProductSearch locationId={location.id} />
                  <MetaRow locationId={location.id} />
                </div>
                <CartTable locationId={location.id} />
                <CartTotals locationId={location.id} />
                {/* slot:cart */}
```

Replace `{/* slot:dialogs */}` with:

```tsx
          <AddCustomerDialog locationId={location!.id} />
          {/* slot:dialogs */}
```

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm run lint`, then check in the browser at `/pos`:
- Typing "ri" shows suggestions; ↓ then Enter adds the item, the row flashes, and search clears.
- Pasting an exact SKU and pressing Enter adds it at once. Typing gibberish and pressing Enter shows the "No product matches" toast.
- Re-adding the same product bumps qty. Stepping past stock shows the insufficient-stock toast.
- Expanding a row shows unit price, discount, and note. A serial product auto-expands, and Enter adds a chip.
- Picking a customer shows due and points badges. The ➕ button creates a customer, and the new customer is selected.
- The totals footer updates live.

- [ ] **Step 10: Commit**

```bash
git add features/pos app/globals.css
git commit -m "feat(pos): cart pane — customer picker, scanner search, cart rows, totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Product grid

**Files:**
- Create: `features/pos/grid/ProductGrid.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:grid`)

**Interfaces:**
- Consumes:
  - `usePosProducts` (Task 7), `useAddToCart` (Task 8)
  - `PosProduct`, `PosCatalogQuery` (Task 3), `useLookups`
- Produces: `ProductGrid({ locationId })`

- [ ] **Step 1: Grid**

```tsx
// features/pos/grid/ProductGrid.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PackageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosProducts } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PosProduct } from "@/lib/data/services/pos";
import { useFormat } from "@/lib/i18n/format";
import { useCart } from "@/lib/pos/store";
import { focusSearch } from "../focus";
import { useAddToCart } from "../usePos";

const PAGE = 40;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function ProductCard({ p, locationId }: { p: PosProduct; locationId: string }) {
  const t = useTranslations("pos.grid");
  const f = useFormat();
  const { data: settings } = useSettings();
  const add = useAddToCart(locationId);
  const [open, setOpen] = useState(false);
  const out = p.manageStock && p.stock <= 0 && !settings?.sale.allowOverselling;
  const low = p.manageStock && p.stock > 0 && p.alertQty !== null && p.stock <= p.alertQty;
  const variable = p.type === "variable" && p.variations.length > 1;

  const pick = (vi: number) => {
    if (add(p, p.variations[vi])) {
      setOpen(false);
      focusSearch();
    }
  };

  const card = (
    <button
      type="button"
      disabled={out}
      onClick={variable ? undefined : () => pick(0)}
      className="group flex min-h-44 flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition hover:border-primary/50 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="relative grid aspect-[4/3] place-items-center bg-muted text-lg font-semibold text-muted-foreground">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="size-full object-cover" />
        ) : (
          initials(p.name)
        )}
        {out && <Badge variant="destructive" className="absolute top-1.5 right-1.5">{t("outOfStock")}</Badge>}
        {low && <Badge className="absolute top-1.5 right-1.5 bg-warning text-warning-foreground">{t("lowStock")}</Badge>}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-2">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</span>
        <span className="mt-auto flex items-center justify-between text-xs">
          <span className="font-semibold tabular-nums">{f.money(p.priceInc)}</span>
          {p.manageStock && <span className="text-muted-foreground tabular-nums">{f.qty(p.stock)}</span>}
        </span>
      </span>
    </button>
  );

  if (!variable) return card;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{card}</PopoverTrigger>
      <PopoverContent className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("chooseVariation")}</p>
        {p.variations.map((v, i) => {
          const vOut = p.manageStock && v.stock <= 0 && !settings?.sale.allowOverselling;
          return (
            <Button key={v.id} variant="ghost" className="w-full justify-between" disabled={vOut} onClick={() => pick(i)}>
              <span className="truncate">{v.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {f.money(v.priceInc)}
                {p.manageStock && ` · ${f.qty(v.stock)}`}
              </span>
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function ProductGrid({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.grid");
  const { data: lookups } = useLookups();
  const { cart } = useCart(locationId);
  const [featured, setFeatured] = useState(false);
  const [categoryId, setCategoryId] = useState<string>();
  const [brandId, setBrandId] = useState<string>();
  const [size, setSize] = useState(PAGE);
  const { data, isPending } = usePosProducts({
    locationId, contactId: cart.contactId, featured, categoryId, brandId, page: 0, pageSize: size,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = !!data && data.rows.length < data.total;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSize((s) => s + PAGE), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  const filter = (fn: () => void) => () => {
    fn();
    setSize(PAGE);
  };
  const categories = (lookups?.categories ?? []).filter((c) => !c.parentId);
  const brands = lookups?.brands ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-2 border-b bg-card/60 p-3">
        <div className="flex gap-2">
          <Chip active={!featured} onClick={filter(() => setFeatured(false))}>{t("all")}</Chip>
          <Chip active={featured} onClick={filter(() => setFeatured(true))}>{t("featured")}</Chip>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("allCategories")}>
          <Chip active={!categoryId} onClick={filter(() => setCategoryId(undefined))}>{t("allCategories")}</Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={filter(() => setCategoryId(c.id))}>{c.name}</Chip>
          ))}
        </div>
        {brands.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("allBrands")}>
            <Chip active={!brandId} onClick={filter(() => setBrandId(undefined))}>{t("allBrands")}</Chip>
            {brands.map((b) => (
              <Chip key={b.id} active={brandId === b.id} onClick={filter(() => setBrandId(b.id))}>{b.name}</Chip>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : !data?.rows.length ? (
          <EmptyState icon={PackageIcon} title={t("empty")} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {data.rows.map((p) => <ProductCard key={p.id} p={p} locationId={locationId} />)}
          </div>
        )}
        <div ref={sentinel} className="h-px" />
      </div>
    </div>
  );
}
```

> The IntersectionObserver callback calls `setSize` asynchronously, so it isn't a synchronous setState in the effect body and the React Compiler lint allows it. If the linter still flags it, move the observer into a callback ref.

- [ ] **Step 2: Fill the slot**

In `PosScreen.tsx` add `import { ProductGrid } from "./grid/ProductGrid";`, then replace `{/* slot:grid */}` with:

```tsx
                <ProductGrid locationId={location.id} />
                {/* slot:grid */}
```

- [ ] **Step 3: Verify**

Run `npm run typecheck && npm run lint`, then check in the browser:
- Category and brand chips filter the grid, and Featured shows the location's featured products.
- Scrolling to the bottom loads more.
- A variable product opens the variation popover.
- An out-of-stock card is dimmed.
- Clicking a card adds the item and search regains focus.

- [ ] **Step 4: Commit**

```bash
git add features/pos
git commit -m "feat(pos): product grid with filters, variations, stock badges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Action bar and payment dialog

**Files:**
- Create: `features/pos/usePosCommands.ts`, `features/pos/ActionBar.tsx`, `features/pos/dialogs/Denominations.tsx`, `features/pos/dialogs/Payment.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:actions`, `slot:dialogs`)

**Interfaces:**
- Consumes:
  - `useCheckout`, `usePosDialogs` with `PaymentMode = "multiple" | PaymentMethod` (Task 7)
  - `paymentState` (Task 2); `tillMethods`, `methodLabel`, `BKASH`, `NAGAD` (Task 2)
  - `usePosTotals` (Task 8)
  - `CheckoutPayment` (Task 5)
- Produces:

```ts
// usePosCommands.ts
export function usePosCommands(location: Location): {
  empty: boolean; pending: boolean; payable: number;
  express(): void; credit(): void; draft(): void; quotation(): void;
  pay(mode: PaymentMode): void; suspend(): void; cancel(): void;
};
// Denominations.tsx
export function Denominations(props: { notes: number[]; counts: Record<string, number>; onChange(c: Record<string, number>): void }): JSX.Element;
export const denominationTotal: (counts: Record<string, number>) => number;
// Payment.tsx
export function PaymentDialog(props: { location: Location }): JSX.Element;
```

- [ ] **Step 1: Commands shared by buttons and hotkeys**

```ts
// features/pos/usePosCommands.ts
"use client";

import type { Location } from "@/lib/data/schemas";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs, type PaymentMode } from "./dialogStore";
import { useCheckout } from "./usePosAction";
import { usePosTotals } from "./usePos";

/** Every sale-level action, guarded against an empty cart and a checkout in flight. */
export function usePosCommands(location: Location) {
  const { cart } = useCart(location.id);
  const totals = usePosTotals(location.id);
  const { run, pending } = useCheckout(location.id);
  const { show, showPayment } = usePosDialogs();
  const empty = cart.lines.length === 0;
  const payable = totals?.total ?? 0;
  const guard = (fn: () => void) => () => {
    if (!empty && !pending) fn();
  };

  return {
    empty,
    pending,
    payable,
    express: guard(() => void run("final", [{ method: "cash", amount: payable }])),
    credit: guard(() => void run("final", [])),
    draft: guard(() => void run("draft")),
    quotation: guard(() => void run("quotation")),
    pay: (mode: PaymentMode) => guard(() => showPayment(mode))(),
    suspend: guard(() => show("suspend")),
    cancel: guard(() => show("cancel")),
  };
}
```

- [ ] **Step 2: Action bar**

```tsx
// features/pos/ActionBar.tsx
"use client";

import {
  BanknoteIcon, CreditCardIcon, FileTextIcon, HandCoinsIcon, LayersIcon, PauseIcon, PencilLineIcon, SmartphoneIcon, XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Location } from "@/lib/data/schemas";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { BKASH, NAGAD, methodLabel, tillMethods } from "@/lib/pos/methods";
import { usePosCommands } from "./usePosCommands";

export function ActionBar({ location }: { location: Location }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const cmd = usePosCommands(location);
  if (!settings) return null;
  const p = settings.pos;
  const labels = settings.customLabels.payments;
  const methods = tillMethods(location.paymentMethods, labels);
  const off = cmd.empty || cmd.pending;

  return (
    <footer className="flex h-16 shrink-0 items-center gap-2 border-t bg-card px-3">
      <Button variant="outline" onClick={cmd.quotation} disabled={off}>
        <FileTextIcon />
        {t("pos.actions.quotation")}
      </Button>
      {!p.disableDraft && (
        <Button variant="outline" onClick={cmd.draft} disabled={off}>
          <PencilLineIcon />
          {t("pos.actions.draft")}
        </Button>
      )}
      {!p.disableSuspend && (
        <Button variant="outline" onClick={cmd.suspend} disabled={off}>
          <PauseIcon />
          {t("pos.actions.suspend")}
        </Button>
      )}
      {!p.disableCreditSaleButton && (
        <Button variant="outline" onClick={cmd.credit} disabled={off}>
          <HandCoinsIcon />
          {t("pos.actions.creditSale")}
        </Button>
      )}
      {methods.includes("card") && (
        <Button variant="outline" onClick={() => cmd.pay("card")} disabled={off}>
          <CreditCardIcon />
          {t("pos.actions.card")}
        </Button>
      )}
      {!p.disableMultiplePay && (
        <Button variant="outline" onClick={() => cmd.pay("multiple")} disabled={off}>
          <LayersIcon />
          {t("pos.actions.multiplePay")}
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {methods.includes(BKASH) && (
          <Button onClick={() => cmd.pay(BKASH)} disabled={off} className="bg-[#E2136E] text-white hover:bg-[#c5105f]">
            <SmartphoneIcon />
            {methodLabel(BKASH, t, labels)}
          </Button>
        )}
        {methods.includes(NAGAD) && (
          <Button onClick={() => cmd.pay(NAGAD)} disabled={off} className="bg-[#F6921E] text-white hover:bg-[#dc8219]">
            <SmartphoneIcon />
            {methodLabel(NAGAD, t, labels)}
          </Button>
        )}
        <div className="px-3 text-right" aria-live="polite">
          <div className="text-xs text-muted-foreground">{t("pos.totals.payable")}</div>
          <div className="text-2xl font-semibold tabular-nums">{f.money(cmd.payable)}</div>
        </div>
        {!p.disableExpressCheckout && (
          <Button size="lg" onClick={cmd.express} disabled={off} className="h-12 min-w-32 bg-success text-success-foreground hover:bg-success/90">
            <BanknoteIcon />
            {t("pos.actions.cash")}
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={cmd.cancel} disabled={off} className="h-12 text-destructive hover:text-destructive">
          <XIcon />
          {t("pos.actions.cancel")}
        </Button>
      </div>
    </footer>
  );
}
```

> The bKash (#E2136E) and Nagad (#F6921E) colours are brand colours (spec § 3.4), so the literal hex is intended.

- [ ] **Step 3: Denominations grid**

```tsx
// features/pos/dialogs/Denominations.tsx
"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/lib/i18n/format";
import { roundMoney } from "@/lib/domain/money";

export const denominationTotal = (counts: Record<string, number>) =>
  roundMoney(Object.entries(counts).reduce((s, [note, n]) => s + Number(note) * (n || 0), 0));

/** Note × count grid; `counts` is keyed by the note value as a string. */
export function Denominations({ notes, counts, onChange }: {
  notes: number[]; counts: Record<string, number>; onChange: (c: Record<string, number>) => void;
}) {
  const t = useTranslations("pos.pay");
  const f = useFormat();
  return (
    <fieldset className="grid gap-2 rounded-lg border p-3">
      <legend className="px-1 text-xs text-muted-foreground">{t("denominations")}</legend>
      <div className="grid grid-cols-3 gap-2">
        {notes.map((n) => (
          <label key={n} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-right tabular-nums">{f.amount(n)} ×</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={counts[n] || ""}
              onChange={(e) => onChange({ ...counts, [n]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              className="h-8 w-16 tabular-nums"
            />
          </label>
        ))}
      </div>
      <p className="text-right text-sm font-medium tabular-nums">{f.money(denominationTotal(counts))}</p>
    </fieldset>
  );
}
```

- [ ] **Step 4: Payment dialog**

```tsx
// features/pos/dialogs/Payment.tsx
"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Location, Payment, PaymentMethod } from "@/lib/data/schemas";
import { useSettings } from "@/lib/data/hooks/settings";
import type { CheckoutPayment } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { WALK_IN_ID } from "@/lib/pos/cart";
import { useHotkeys } from "@/lib/pos/hotkeys";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { paymentState } from "@/lib/pos/selectors";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { useCheckout } from "../usePosAction";
import { usePosTotals } from "../usePos";
import { Denominations, denominationTotal } from "./Denominations";

type Row = { id: number; method: PaymentMethod; amount: string; details: Payment["details"]; counts: Record<string, number> };

let seq = 0;
const newRow = (method: PaymentMethod, amount: number): Row => ({ id: ++seq, method, amount: amount ? String(amount) : "", details: {}, counts: {} });

function PaymentForm({ location }: { location: Location }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { cart } = useCart(location.id);
  const totals = usePosTotals(location.id);
  const mode = usePosDialogs((s) => s.paymentMode);
  const hide = usePosDialogs((s) => s.hide);
  const { run, pending } = useCheckout(location.id);
  const payable = totals?.total ?? 0;
  const [rows, setRows] = useState<Row[]>(() => [newRow(mode === "multiple" ? "cash" : mode, payable)]);
  const [note, setNote] = useState("");
  const shortcuts = settings?.pos.shortcuts;
  const state = paymentState(payable, rows.map((r) => ({ method: r.method, amount: Number(r.amount) || 0 })));

  const addRow = () => setRows((rs) => [...rs, newRow("cash", state.shortfall)]);
  useHotkeys({
    [shortcuts?.addPaymentRow ?? ""]: addRow,
    [shortcuts?.finalizePayment ?? ""]: () => void finalize(),
  });
  if (!settings) return null;

  const labels = settings.customLabels.payments;
  const methods = tillMethods(location.paymentMethods, labels);
  const pay = settings.payment;
  const denomFor = (m: PaymentMethod) => pay.cashDenominations.length > 0 && pay.denominationMethods.includes(m);
  const strictMismatch = pay.denominationStrict && rows.some((r) => denomFor(r.method) && denominationTotal(r.counts) !== (Number(r.amount) || 0));
  const walkIn = cart.contactId === WALK_IN_ID;
  const blocked = state.nonCashOverpaid || strictMismatch || (state.shortfall > 0 && walkIn) || pending;

  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  async function finalize() {
    if (!settings || blocked) return; // `settings` first: `blocked` isn't initialised on the loading render
    const payments: CheckoutPayment[] = rows
      .map((r) => ({ method: r.method, amount: Number(r.amount) || 0, details: r.details }))
      .filter((p) => p.amount > 0);
    await run("final", payments, note || undefined);
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void finalize();
  };

  const detail = (r: Row, key: keyof Payment["details"], label: string, cls = "") => (
    <div className={cn("grid gap-1", cls)}>
      <Label className="text-xs">{label}</Label>
      <Input value={r.details[key] ?? ""} onChange={(e) => patch(r.id, { details: { ...r.details, [key]: e.target.value } })} className="h-8" />
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.pay.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_16rem] gap-5">
        <div className="grid max-h-[60vh] content-start gap-3 overflow-auto pr-1">
          {rows.map((r, i) => (
            <div key={r.id} className="grid gap-3 rounded-lg border bg-card p-3">
              <div className="flex items-end gap-2">
                <div className="grid flex-1 gap-1">
                  <Label className="text-xs">{t("pos.pay.method")}</Label>
                  <Select value={r.method} onValueChange={(m) => patch(r.id, { method: m as PaymentMethod, details: {}, counts: {} })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m} value={m}>
                          {methodLabel(m, t, labels)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid flex-1 gap-1">
                  <Label className="text-xs" htmlFor={`amt-${r.id}`}>
                    {r.method === "cash" ? t("pos.pay.given") : t("pos.pay.amount")}
                  </Label>
                  <Input
                    id={`amt-${r.id}`}
                    type="number"
                    min={0}
                    step="any"
                    autoFocus={i === rows.length - 1}
                    readOnly={pay.denominationStrict && denomFor(r.method)}
                    value={r.amount}
                    onChange={(e) => patch(r.id, { amount: e.target.value })}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-9 text-right text-base tabular-nums"
                  />
                </div>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("pos.pay.removeRow")} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                    <Trash2Icon />
                  </Button>
                )}
              </div>
              {r.method === "card" && (
                <div className="grid grid-cols-2 gap-2">
                  {detail(r, "cardNumber", t("pos.pay.cardNumber"))}
                  {detail(r, "cardHolder", t("pos.pay.cardHolder"))}
                  <div className="grid gap-1">
                    <Label className="text-xs">{t("pos.pay.cardType")}</Label>
                    <Select value={r.details.cardType ?? ""} onValueChange={(v) => patch(r.id, { details: { ...r.details, cardType: v as NonNullable<Payment["details"]["cardType"]> } })}>
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["visa", "master", "credit", "debit"] as const).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {detail(r, "cardTxnNo", t("pos.pay.txnNo"))}
                </div>
              )}
              {r.method.startsWith("custom_pay_") && detail(r, "txnNo", t("pos.pay.txnNo"))}
              {r.method === "cheque" && detail(r, "chequeNo", t("payMethods.cheque"))}
              {r.method === "bank_transfer" && detail(r, "bankAccountNo", t("payMethods.bank_transfer"))}
              {denomFor(r.method) && (
                <Denominations
                  notes={pay.cashDenominations}
                  counts={r.counts}
                  onChange={(counts) => patch(r.id, { counts, amount: String(denominationTotal(counts)) })}
                />
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addRow} className="justify-self-start">
            <PlusIcon />
            {t("pos.pay.addRow")}
          </Button>
          <div className="grid gap-1">
            <Label className="text-xs" htmlFor="pay-note">{t("common.note")}</Label>
            <Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <dl className="grid content-start gap-3 rounded-xl bg-muted/50 p-4 text-sm" aria-live="polite">
          <div>
            <dt className="text-muted-foreground">{t("pos.totals.payable")}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{f.money(payable)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("pos.pay.paid")}</dt>
            <dd className="tabular-nums">{f.money(state.paid)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("pos.pay.remaining")}</dt>
            <dd className={cn("tabular-nums", state.shortfall > 0 && "font-medium text-danger")}>{f.money(state.shortfall)}</dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="font-medium">{t("pos.pay.change")}</dt>
            <dd className="text-xl font-semibold text-success tabular-nums">{f.money(state.change)}</dd>
          </div>
          {state.nonCashOverpaid && <p className="text-xs text-danger">{t("pos.pay.nonCashOverpaid")}</p>}
          {state.shortfall > 0 && walkIn && <p className="text-xs text-danger">{t("pos.errors.walkInCredit")}</p>}
        </dl>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={blocked}>
          {t("pos.pay.finalize")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PaymentDialog({ location }: { location: Location }) {
  const open = usePosDialogs((s) => s.open === "payment");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-3xl">{open && <PaymentForm location={location} />}</DialogContent>
    </Dialog>
  );
}
```

Notes for the implementer:
- `useHotkeys` stores its map in a ref, so its handlers always see the latest render; `finalize` is a function declaration so the hotkey map can reference it before the settings-dependent values below it are computed. `useHotkeys` skips empty specs.
- Credit limit and other service errors surface through `useCheckout` → `usePosError` as toasts, and the dialog stays open.

- [ ] **Step 5: Fill the slots**

In `PosScreen.tsx` add:

```tsx
import { ActionBar } from "./ActionBar";
import { PaymentDialog } from "./dialogs/Payment";
```

Replace `{/* slot:actions */}` with:

```tsx
            <ActionBar location={location} />
            {/* slot:actions */}
```

Add `<PaymentDialog location={location!} />` before `{/* slot:dialogs */}`.

- [ ] **Step 6: Verify**

Run `npm run typecheck && npm run lint`, then check in the browser:
- Add two items and click **Cash**: the toast shows the sale was completed, the cart clears, and the receipt dialog state opens. Nothing renders yet; that arrives in Task 15.
- **Multiple pay**: cash 500 plus a bKash row for the rest, with a txn ID. Remaining shows 0, and Finalize completes the sale.
- Cash 2000 on a total of 1500 shows 500 change.
- Card 2000 shows the non-cash warning and Finalize is disabled.
- With the walk-in customer and a shortfall, Finalize is disabled.
- **Credit sale** with walk-in shows the walk-in toast. With a named customer it succeeds.
- **Draft** and **Quotation** show a toast with a Print action.

- [ ] **Step 7: Commit**

```bash
git add features/pos
git commit -m "feat(pos): action bar, split payment dialog with denominations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Order-level dialogs — discount, order tax, shipping, points, cancel

**Files:**
- Create: `features/pos/dialogs/Discount.tsx`, `features/pos/dialogs/OrderTax.tsx`, `features/pos/dialogs/Shipping.tsx`, `features/pos/dialogs/RedeemPoints.tsx`, `features/pos/dialogs/Cancel.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:dialogs`)

**Interfaces:**
- Consumes:
  - `patchCart`, `ShippingZone` (Task 1)
  - `discountValue` (`lib/domain/totals`); `maxRedeemable`, `redeemValue` (`lib/domain/rewards`)
  - `useContact`, `usePosTotals`
- Produces: `DiscountDialog`, `OrderTaxDialog`, `ShippingDialog`, `RedeemPointsDialog`, `CancelDialog`, each taking `{ locationId: string }`.

- [ ] **Step 1: Discount**

```tsx
// features/pos/dialogs/Discount.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCan } from "@/lib/auth/useCan";
import { discountValue, type DiscountInput } from "@/lib/domain/totals";
import { useFormat } from "@/lib/i18n/format";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosTotals } from "../usePos";

function DiscountForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { cart, update } = useCart(locationId);
  const totals = usePosTotals(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [type, setType] = useState<DiscountInput["type"]>(cart.discount?.type ?? "fixed");
  const [amount, setAmount] = useState(cart.discount?.amount ? String(cart.discount.amount) : "");
  const d: DiscountInput = { type, amount: Math.max(0, Number(amount) || 0) };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update((c) => patchCart(c, { discount: d.amount > 0 ? d : null }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.discount.title")}</DialogTitle>
      </DialogHeader>
      <ToggleGroup type="single" variant="outline" value={type} onValueChange={(v) => v && setType(v as DiscountInput["type"])} className="w-full">
        <ToggleGroupItem value="fixed" className="flex-1">{t("pos.discount.fixed")}</ToggleGroupItem>
        <ToggleGroupItem value="percentage" className="flex-1">{t("pos.discount.percentage")}</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid gap-2">
        <Label htmlFor="disc-amount">{t("pos.discount.amount")}</Label>
        <Input id="disc-amount" type="number" min={0} max={type === "percentage" ? 100 : undefined} step="any" autoFocus disabled={!can("pos.edit_discount")} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
      </div>
      <p className="text-sm text-muted-foreground">{t("pos.discount.preview", { amount: f.money(discountValue(totals?.linesTotal ?? 0, d)) })}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!can("pos.edit_discount")}>{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function DiscountDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "discount");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-sm">{open && <DiscountForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Order tax**

```tsx
// features/pos/dialogs/OrderTax.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useFormat } from "@/lib/i18n/format";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

const NONE = "none";

function OrderTaxForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: lookups } = useLookups();
  const { cart, update } = useCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [taxId, setTaxId] = useState(cart.orderTaxId ?? NONE);
  const rates = lookups?.taxRates ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const rate = rates.find((r) => r.id === taxId);
    update((c) => patchCart(c, { orderTaxId: rate?.id ?? null, orderTaxRate: rate?.rate ?? 0 }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.orderTax.title")}</DialogTitle>
      </DialogHeader>
      <Select value={taxId} onValueChange={setTaxId}>
        <SelectTrigger className="w-full" autoFocus>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("pos.orderTax.none")}</SelectItem>
          {rates.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {`${r.name} (${f.percent(r.rate)})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit">{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function OrderTaxDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "orderTax");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-sm">{open && <OrderTaxForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Shipping**

```tsx
// features/pos/dialogs/Shipping.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/lib/data/hooks/settings";
import { patchCart, type CartShipping, type ShippingZone } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

const ZONES: ShippingZone[] = ["inside_dhaka", "outside_dhaka", "free"];

function ShippingForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const { data: settings } = useSettings();
  const { cart, update } = useCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [s, setS] = useState<CartShipping>(cart.shipping);
  const [charges, setCharges] = useState(cart.shipping.charges ? String(cart.shipping.charges) : "");

  const pickZone = (zone: ShippingZone) => {
    setS((x) => ({ ...x, zone }));
    const preset = zone === "free" ? 0 : settings?.pos.shippingCharges[zone] ?? 0;
    setCharges(String(preset));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update((c) => patchCart(c, { shipping: { ...s, charges: Math.max(0, Number(charges) || 0) } }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.shipping.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label>{t("pos.shipping.zone")}</Label>
        <ToggleGroup type="single" variant="outline" value={s.zone ?? ""} onValueChange={(v) => v && pickZone(v as ShippingZone)} className="w-full">
          {ZONES.map((z) => (
            <ToggleGroupItem key={z} value={z} className="flex-1">{t(`pos.shipping.${z}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-charges">{t("pos.shipping.charges")}</Label>
        <Input id="ship-charges" type="number" min={0} step="any" value={charges} onChange={(e) => setCharges(e.target.value)} className="tabular-nums" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-details">{t("pos.shipping.details")}</Label>
        <Input id="ship-details" value={s.details} onChange={(e) => setS((x) => ({ ...x, details: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-address">{t("pos.shipping.address")}</Label>
        <Textarea id="ship-address" rows={2} value={s.address} onChange={(e) => setS((x) => ({ ...x, address: e.target.value }))} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit">{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function ShippingDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "shipping");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-md">{open && <ShippingForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Redeem points**

```tsx
// features/pos/dialogs/RedeemPoints.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContact } from "@/lib/data/hooks/contacts";
import { useSettings } from "@/lib/data/hooks/settings";
import { maxRedeemable, redeemValue } from "@/lib/domain/rewards";
import { useFormat } from "@/lib/i18n/format";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosTotals } from "../usePos";

function RedeemForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { cart, update } = useCart(locationId);
  const { data: contact } = useContact(cart.contactId);
  const totals = usePosTotals(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [points, setPoints] = useState(cart.pointsRedeemed ? String(cart.pointsRedeemed) : "");
  if (!settings || !totals) return null;

  const balance = contact?.points ?? 0;
  const max = maxRedeemable({ total: totals.total + totals.redeemed, balance, s: settings.rewards });
  const n = Math.floor(Number(points) || 0);
  const valid = n >= 0 && n <= max;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    update((c) => patchCart(c, { pointsRedeemed: n }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{settings.rewards.displayName || t("pos.points.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-1 text-sm">
        <p>{t("pos.points.available", { points: f.number(balance) })}</p>
        <p className="text-muted-foreground">{t("pos.points.max", { points: f.number(max) })}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="redeem">{t("pos.points.label")}</Label>
        <Input id="redeem" type="number" min={0} max={max} step={1} autoFocus value={points} onChange={(e) => setPoints(e.target.value)} aria-invalid={!valid} className="tabular-nums" />
        {!valid && <p className="text-xs text-destructive">{t("pos.errors.pointsInvalid")}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{t("pos.points.value", { amount: f.money(redeemValue(valid ? n : 0, settings.rewards)) })}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!valid}>{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function RedeemPointsDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "points");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-sm">{open && <RedeemForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Cancel confirm**

```tsx
// features/pos/dialogs/Cancel.tsx
"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

export function CancelDialog({ locationId }: { locationId: string }) {
  const t = useTranslations("pos");
  const open = usePosDialogs((s) => s.open === "cancel");
  const hide = usePosDialogs((s) => s.hide);
  const { reset } = useCart(locationId);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && hide()}
      title={t("cancelConfirm.title")}
      description={t("cancelConfirm.body")}
      confirmLabel={t("actions.cancel")}
      destructive
      onConfirm={() => {
        reset();
        toast(t("done.cancelled"));
        hide();
        focusSearch();
      }}
    />
  );
}
```

- [ ] **Step 6: Mount**

In `PosScreen.tsx` import the five dialogs and add before `{/* slot:dialogs */}`:

```tsx
          <DiscountDialog locationId={location!.id} />
          <OrderTaxDialog locationId={location!.id} />
          <ShippingDialog locationId={location!.id} />
          <RedeemPointsDialog locationId={location!.id} />
          <CancelDialog locationId={location!.id} />
```

- [ ] **Step 7: Verify and commit**

Run `npm run typecheck && npm run lint`. In the browser, check:
- A 10% discount shows its preview, and the totals update.
- Order tax changes the total.
- Shipping "Outside Dhaka" prefills 120 and can be edited.
- A named customer with points can redeem up to the max; above the max, the input is flagged.
- Cancel clears the cart after confirmation.

```bash
git add features/pos
git commit -m "feat(pos): discount, order tax, shipping, points, cancel dialogs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Suspend, suspended sales, recent transactions

**Files:**
- Create: `features/pos/dialogs/Suspend.tsx`, `features/pos/dialogs/SaleList.tsx`, `features/pos/dialogs/Suspended.tsx`, `features/pos/dialogs/Recent.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:dialogs`)

**Interfaces:**
- Consumes:
  - `usePosSales`, `usePosMutations().loadCart | remove` (Task 7)
  - `SaleRow`, `SaleStatus` (Task 5)
  - `useCheckout` (Task 7)
- Produces:
  - `SuspendDialog({ locationId })`, `SuspendedSheet({ locationId })`, `RecentSheet({ locationId })`
  - `SaleList({ locationId, status, onPrint? })`: a list with Resume/Edit, Print, and Delete

- [ ] **Step 1: Suspend (note prompt)**

```tsx
// features/pos/dialogs/Suspend.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePosDialogs } from "../dialogStore";
import { useCheckout } from "../usePosAction";

function SuspendForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const hide = usePosDialogs((s) => s.hide);
  const { run, pending } = useCheckout(locationId);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("suspended", [], note.trim() || undefined);
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.suspend.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="suspend-note">{t("pos.suspend.note")}</Label>
        <Textarea id="suspend-note" rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={pending}>{t("pos.suspend.confirm")}</Button>
      </DialogFooter>
    </form>
  );
}

export function SuspendDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "suspend");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-md">{open && <SuspendForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Shared sale list**

```tsx
// features/pos/dialogs/SaleList.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InboxIcon, PencilIcon, PlayIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePosMutations, usePosSales } from "@/lib/data/hooks/pos";
import type { SaleRow, SaleStatus } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

/**
 * Sales of one status at this location. Non-final rows can be loaded into the cart
 * (confirming first when the cart has items) or deleted. Final rows link to the full edit screen.
 */
export function SaleList({ locationId, status }: { locationId: string; status: SaleStatus }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const { data, isPending } = usePosSales({ locationId, status, limit: status === "suspended" ? 50 : 10 });
  const { loadCart, remove } = usePosMutations();
  const { cart, replace } = useCart(locationId);
  const { hide, showReceipt } = usePosDialogs();
  const onError = usePosError();
  const [confirm, setConfirm] = useState<{ kind: "load" | "delete"; row: SaleRow } | null>(null);

  const load = async (row: SaleRow) => {
    try {
      replace(await loadCart.mutateAsync(row.id));
      toast.success(t("pos.suspended.resumed", { ref: row.refNo }));
      hide();
      focusSearch();
    } catch (e) {
      onError(e);
    }
  };
  const del = async (row: SaleRow) => {
    try {
      await remove.mutateAsync(row.id);
      toast.success(t("pos.recent.deleted", { ref: row.refNo }));
    } catch (e) {
      onError(e);
    }
  };
  const edit = (row: SaleRow) => {
    if (status === "final") return router.push(`/sales/${row.id}/edit`);
    if (cart.lines.length) setConfirm({ kind: "load", row });
    else void load(row);
  };

  if (isPending) return <div className="grid gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (!data?.length) return <EmptyState icon={InboxIcon} title={status === "suspended" ? t("pos.suspended.empty") : t("pos.recent.empty")} />;

  return (
    <>
      <ul className="grid gap-2 p-4">
        {data.map((row) => (
          <li key={row.id} className="grid gap-1 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium tabular-nums">{row.refNo}</span>
              <span className="font-semibold tabular-nums">{f.money(row.total)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{`${row.contactName} · ${f.qty(row.itemsCount)} ${t("pos.totals.items")}`}</span>
              <span className="tabular-nums">{f.dateTime(row.date)}</span>
            </div>
            {row.note && <p className="text-xs text-muted-foreground italic">{row.note}</p>}
            <div className="mt-1 flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => showReceipt(row.id)}>
                <PrinterIcon />
                {t("common.print")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => edit(row)} disabled={loadCart.isPending}>
                {status === "suspended" ? <PlayIcon /> : <PencilIcon />}
                {status === "suspended" ? t("pos.suspended.resume") : t("common.edit")}
              </Button>
              {status !== "final" && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirm({ kind: "delete", row })}>
                  <Trash2Icon />
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === "delete" ? t("common.areYouSure") : t("pos.suspended.resume")}
        description={confirm?.kind === "delete" ? t("common.cannotUndo") : t("pos.suspended.replaceCart")}
        confirmLabel={confirm?.kind === "delete" ? t("common.delete") : t("common.confirm")}
        destructive={confirm?.kind === "delete"}
        onConfirm={() => {
          if (!confirm) return;
          void (confirm.kind === "delete" ? del(confirm.row) : load(confirm.row));
          setConfirm(null);
        }}
      />
    </>
  );
}
```

> `showReceipt` switches the open dialog to `"receipt"`, which closes the sheet. After printing, the cashier returns to the sale screen, as in the reference app.

- [ ] **Step 3: Sheets**

```tsx
// features/pos/dialogs/Suspended.tsx
"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePosDialogs } from "../dialogStore";
import { SaleList } from "./SaleList";

export function SuspendedSheet({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.suspended");
  const open = usePosDialogs((s) => s.open === "suspended");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && hide()}>
      <SheetContent side="right" className="w-[420px] gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto">{open && <SaleList locationId={locationId} status="suspended" />}</div>
      </SheetContent>
    </Sheet>
  );
}
```

```tsx
// features/pos/dialogs/Recent.tsx
"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SaleStatus } from "@/lib/data/services/sales";
import { usePosDialogs } from "../dialogStore";
import { SaleList } from "./SaleList";

const TABS: SaleStatus[] = ["final", "quotation", "draft"];

export function RecentSheet({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const open = usePosDialogs((s) => s.open === "recent");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && hide()}>
      <SheetContent side="right" className="w-[440px] gap-0 p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b">
          <SheetTitle>{t("pos.recent.title")}</SheetTitle>
        </SheetHeader>
        {open && (
          <Tabs defaultValue="final" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 mt-3">
              {TABS.map((s) => (
                <TabsTrigger key={s} value={s}>{t(`status.${s}`)}</TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((s) => (
              <TabsContent key={s} value={s} className="min-h-0 overflow-auto">
                <SaleList locationId={locationId} status={s} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Mount**

In `PosScreen.tsx`, import the three components and add before `{/* slot:dialogs */}`:

```tsx
          <SuspendDialog locationId={location!.id} />
          <SuspendedSheet locationId={location!.id} />
          <RecentSheet locationId={location!.id} />
```

- [ ] **Step 5: Verify and commit**

Run `npm run typecheck && npm run lint`, then check in the browser:
- Suspend with a note: the cart clears and the top-bar badge shows 1.
- In the Suspended sheet, Resume reloads the items. Paying for it removes the suspended entry (the badge goes to 0).
- Recent → Draft → Edit loads the draft, and Delete asks for confirmation before removing it.
- Recent → Final → Edit navigates to `/sales/[id]/edit` (placeholder).

```bash
git add features/pos
git commit -m "feat(pos): suspend, suspended sales and recent transactions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Register details / close, add expense

**Files:**
- Create: `features/pos/dialogs/RegisterClose.tsx`, `features/pos/dialogs/AddExpense.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:dialogs`)

**Interfaces:**
- Consumes:
  - `useCurrentRegister`, `useRegisterSummary`, `usePosMutations().closeRegister | createExpense` (Task 7)
  - `RegisterSummary` (Task 6)
  - `Denominations`, `denominationTotal` (Task 11)
  - `methodLabel`, `tillMethods` (Task 2)
- Produces: `RegisterDialog({ location })`, which covers both `"registerDetails"` and `"registerClose"`, and `AddExpenseDialog({ location })`.

- [ ] **Step 1: Register details and close**

```tsx
// features/pos/dialogs/RegisterClose.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Location } from "@/lib/data/schemas";
import { useCurrentRegister, usePosMutations, useRegisterSummary } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { roundMoney } from "@/lib/domain/money";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { usePosDialogs } from "../dialogStore";
import { usePosError } from "../usePosAction";
import { Denominations, denominationTotal } from "./Denominations";

function RegisterBody({ location, closing }: { location: Location; closing: boolean }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const register = useCurrentRegister(location.id).data;
  const { data: sum } = useRegisterSummary(register?.id);
  const { closeRegister } = usePosMutations();
  const hide = usePosDialogs((s) => s.hide);
  const onError = usePosError();
  const [counted, setCounted] = useState("");
  const [cardSlips, setCardSlips] = useState("");
  const [cheques, setCheques] = useState("");
  const [note, setNote] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  if (!register || !sum || !settings) return <Skeleton className="h-64" />;

  const countedCash = Number(counted) || 0;
  const diff = roundMoney(countedCash - sum.expectedCash);
  const row = (label: string, value: number, strong = false) => (
    <tr className={cn("border-b last:border-0", strong && "font-semibold")}>
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{f.money(value)}</td>
    </tr>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await closeRegister.mutateAsync({
        id: register.id, closingAmount: countedCash, totalCardSlips: Number(cardSlips) || 0,
        totalCheques: Number(cheques) || 0, closingNote: note, denominations: counts,
      });
      toast.success(t("pos.register.closed"));
      hide();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{closing ? t("pos.register.closeTitle") : t("pos.register.detailsTitle")}</DialogTitle>
        <DialogDescription>{`${location.name} · ${t("pos.register.openedAt", { time: f.dateTime(register.openedAt) })}`}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-6">
        <table className="text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-medium">{t("pos.register.method")}</th>
              <th className="py-1.5 text-right font-medium">{t("pos.register.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {sum.byMethod.map((m) => (
              <tr key={m.method} className="border-b">
                <td className="py-1.5">{`${methodLabel(m.method, t, settings.customLabels.payments)} (${f.number(m.count)})`}</td>
                <td className="py-1.5 text-right tabular-nums">{f.money(m.amount)}</td>
              </tr>
            ))}
            {row(t("pos.register.sales"), sum.totalSales, true)}
          </tbody>
        </table>
        <table className="text-sm">
          <tbody>
            {row(t("pos.register.opening"), sum.opening)}
            {row(`(+) ${t("payMethods.cash")}`, sum.cashIn)}
            {row(`(−) ${t("pos.register.change")}`, sum.change)}
            {row(`(−) ${t("pos.register.refunds")}`, sum.refunds)}
            {row(`(−) ${t("pos.register.expenses")}`, sum.expenses)}
            {row(t("pos.register.expected"), sum.expectedCash, true)}
          </tbody>
        </table>
      </div>

      {closing && (
        <div className="grid gap-4 border-t pt-4">
          {settings.payment.cashDenominations.length > 0 && (
            <Denominations
              notes={settings.payment.cashDenominations}
              counts={counts}
              onChange={(c) => {
                setCounts(c);
                setCounted(String(denominationTotal(c)));
              }}
            />
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="rc-counted">{t("pos.register.counted")}</Label>
              <Input id="rc-counted" type="number" min={0} step="any" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} className="tabular-nums" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="rc-cards">{t("pos.register.cardSlips")}</Label>
              <Input id="rc-cards" type="number" min={0} step={1} value={cardSlips} onChange={(e) => setCardSlips(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="rc-cheques">{t("pos.register.cheques")}</Label>
              <Input id="rc-cheques" type="number" min={0} step={1} value={cheques} onChange={(e) => setCheques(e.target.value)} />
            </div>
          </div>
          <p className={cn("text-right text-sm font-medium tabular-nums", diff < 0 ? "text-danger" : diff > 0 ? "text-warning-foreground dark:text-warning" : "text-success")}>
            {`${t("pos.register.difference")}: ${f.money(diff)}`}
          </p>
          <div className="grid gap-1">
            <Label htmlFor="rc-note">{t("pos.register.note")}</Label>
            <Textarea id="rc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.close")}</Button>
        {closing && (
          <Button type="submit" variant="destructive" disabled={closeRegister.isPending}>
            {t("pos.register.closeTitle")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

export function RegisterDialog({ location }: { location: Location }) {
  const open = usePosDialogs((s) => s.open);
  const hide = usePosDialogs((s) => s.hide);
  const shown = open === "registerDetails" || open === "registerClose";
  return (
    <Dialog open={shown} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-3xl">
        {shown && <RegisterBody location={location} closing={open === "registerClose"} />}
      </DialogContent>
    </Dialog>
  );
}
```

> After closing, `usePosMutations` invalidates every query. `useCurrentRegister` then returns `null`, `PosScreen` renders the gate, and the `ready &&` dialog block unmounts.

- [ ] **Step 2: Add expense**

```tsx
// features/pos/dialogs/AddExpense.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Location, PaymentMethod } from "@/lib/data/schemas";
import { ValidationError } from "@/lib/data/errors";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

function ExpenseForm({ location }: { location: Location }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { createExpense } = usePosMutations();
  const hide = usePosDialogs((s) => s.hide);
  const onError = usePosError();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const labels = settings?.customLabels.payments ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tx = await createExpense.mutateAsync({ locationId: location.id, categoryId, amount: Number(amount) || 0, method, note });
      toast.success(t("pos.expense.added", { ref: tx.refNo }));
      hide();
      focusSearch();
    } catch (err) {
      if (err instanceof ValidationError) setInvalid(err.fields);
      else onError(err);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.expense.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label>{t("pos.expense.category")}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full" aria-invalid={!!invalid.categoryId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(lookups?.expenseCategories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="exp-amount">{t("pos.expense.amount")}</Label>
          <Input id="exp-amount" type="number" min={0} step="any" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!invalid.amount} className="tabular-nums" />
        </div>
        <div className="grid gap-2">
          <Label>{t("pos.expense.method")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tillMethods(location.paymentMethods, labels).map((m) => (
                <SelectItem key={m} value={m}>{methodLabel(m, t, labels)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="exp-note">{t("pos.expense.note")}</Label>
        <Textarea id="exp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createExpense.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

export function AddExpenseDialog({ location }: { location: Location }) {
  const open = usePosDialogs((s) => s.open === "expense");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-md">{open && <ExpenseForm location={location} />}</DialogContent>
    </Dialog>
  );
}
```

> The `ValidationError` field keys come from Task 4's `expensesService.create`: `categoryId` and `amount`.

- [ ] **Step 3: Mount, verify, commit**

In `PosScreen.tsx`, import both components and add before `{/* slot:dialogs */}`:

```tsx
          <RegisterDialog location={location!} />
          <AddExpenseDialog location={location!} />
```

Run `npm run typecheck && npm run lint`, then check in the browser:
- After a cash sale, Register details shows the cash row and the expected cash.
- Add an expense of 100 cash; expected cash drops by 100.
- Close the register with counted = expected: the difference shows 0 in green. Confirming shows the gate again.

```bash
git add features/pos
git commit -m "feat(pos): register details/close and add expense

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Receipt modal, thermal and A4 layouts, Code128, print CSS

**Files:**
- Create: `features/pos/receipt/Barcode.tsx`, `features/pos/receipt/ThermalReceipt.tsx`, `features/pos/receipt/A4Invoice.tsx`, `features/pos/receipt/print.ts`, `features/pos/receipt/ReceiptModal.tsx`
- Modify: `app/globals.css` (print rules), `features/pos/PosScreen.tsx` (`slot:dialogs`)

**Interfaces:**
- Consumes:
  - `useReceipt` (Task 7), `ReceiptData` (Task 5)
  - `code128` (Task 2), `methodLabel` (Task 2)
- Produces:

```ts
export function Barcode(props: { value: string; height?: number; className?: string }): JSX.Element;
export function ThermalReceipt(props: { data: ReceiptData }): JSX.Element;
export function A4Invoice(props: { data: ReceiptData }): JSX.Element;
export type PrintKind = "thermal" | "a4";
export function usePrint(): { printing: PrintKind | null; print(kind: PrintKind): void };
export function ReceiptModal(): JSX.Element;
```

- [ ] **Step 1: Barcode**

```tsx
// features/pos/receipt/Barcode.tsx
import { code128 } from "@/lib/pos/barcode";

/** Inline SVG Code 128 (set B). One module = 1 viewBox unit; the SVG scales to its box. */
export function Barcode({ value, height = 40, className }: { value: string; height?: number; className?: string }) {
  const widths = code128(value);
  const total = widths.reduce((s, w) => s + w, 0) + 20; // 10-module quiet zone each side
  let x = 10;
  const bars = widths.map((w, i) => {
    const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={height} /> : null;
    x += w;
    return rect;
  });
  return (
    <svg viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={value} fill="currentColor">
      {bars}
    </svg>
  );
}
```

- [ ] **Step 2: Thermal receipt**

```tsx
// features/pos/receipt/ThermalReceipt.tsx
"use client";

import { useTranslations } from "next-intl";
import { useSettings } from "@/lib/data/hooks/settings";
import type { ReceiptData } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { Barcode } from "./Barcode";

/** 80mm roll: 72mm printable. Plain black-on-white, so it prints the same in dark mode. */
export function ThermalReceipt({ data }: { data: ReceiptData }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { txn, layout, location } = data;
  const tt = txn.totals;
  const labels = settings?.customLabels.payments ?? [];
  const line = (label: string, value: string, bold = false) => (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <article className="mx-auto w-[72mm] bg-white p-2 font-mono text-[11px] leading-tight text-black">
      <header className="mb-2 text-center">
        {layout.showLogo && data.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.logo} alt="" className="mx-auto mb-1 h-10 object-contain" />
        )}
        {layout.showBusinessName && <h2 className="text-sm font-bold">{data.businessName}</h2>}
        {layout.showLocationName && <p>{location.name}</p>}
        {layout.showAddress && <p>{[location.address.line1, location.address.city].filter(Boolean).join(", ")}</p>}
        {layout.showMobile && location.mobile && <p>{`${t("pos.receipt.mobile")}: ${location.mobile}`}</p>}
        {layout.headerText && <p className="mt-1 whitespace-pre-line">{layout.headerText}</p>}
      </header>
      <div className="border-y border-dashed border-black py-1">
        {line(t("pos.receipt.invoiceNo"), txn.refNo)}
        {line(t("pos.receipt.date"), f.dateTime(txn.date))}
        {line(t("pos.receipt.cashier"), data.cashier)}
        {layout.showCustomer && !data.customer.isWalkIn && line(t("pos.receipt.customer"), `${data.customer.name} ${data.customer.mobile}`)}
      </div>
      <table className="my-1 w-full">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="text-left font-normal">{t("pos.receipt.item")}</th>
            <th className="text-right font-normal">{t("pos.receipt.total")}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5">
                <div>{l.name}</div>
                {layout.showSku && <div className="text-[10px]">{l.sku}</div>}
                <div>{`${f.qty(l.qty)} ${l.unitName} × ${f.amount(l.unitPrice)}`}</div>
                {l.discount > 0 && <div className="text-[10px]">{`− ${f.amount(l.discount)}`}</div>}
                {l.serials.length > 0 && <div className="text-[10px]">{l.serials.join(", ")}</div>}
              </td>
              <td className="py-0.5 text-right tabular-nums">{f.amount(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black pt-1">
        {line(t("pos.totals.subtotal"), f.amount(tt.linesTotal))}
        {tt.discount > 0 && line(`(−) ${t("pos.totals.discount")}`, f.amount(tt.discount))}
        {tt.orderTax > 0 && line(`(+) ${t("pos.totals.orderTax")}`, f.amount(tt.orderTax))}
        {tt.shipping > 0 && line(`(+) ${t("pos.totals.shipping")}`, f.amount(tt.shipping))}
        {tt.redeemed > 0 && line(`(−) ${t("pos.totals.redeemed")}`, f.amount(tt.redeemed))}
        {tt.roundOff !== 0 && line(t("pos.totals.roundOff"), f.amount(tt.roundOff))}
        {line(t("pos.receipt.total"), f.money(tt.total), true)}
      </div>
      {layout.showPaymentInfo && (
        <div className="mt-1 border-t border-dashed border-black pt-1">
          {txn.payments.filter((p) => !p.isReturn).map((p) => line(methodLabel(p.method, t, labels), f.amount(p.amount)))}
          {line(t("pos.receipt.paid"), f.amount(data.paid))}
          {data.change > 0 && line(t("pos.receipt.change"), f.amount(data.change))}
          {data.due > 0 && line(t("pos.receipt.due"), f.amount(data.due), true)}
        </div>
      )}
      {txn.pointsEarned > 0 && <p className="mt-1 text-center">{t("pos.receipt.pointsEarned", { points: f.number(txn.pointsEarned) })}</p>}
      {layout.footerText && <p className="mt-2 text-center whitespace-pre-line">{layout.footerText}</p>}
      <Barcode value={txn.refNo} height={36} className="mx-auto mt-2 h-10 w-[60mm]" />
      <p className="text-center text-[10px] tracking-widest">{txn.refNo}</p>
    </article>
  );
}
```

> The Code128 barcode is always printed, as the spec requires. `layout.showBarcode` controls the product-barcode column on other layouts, not this one.

- [ ] **Step 3: A4 invoice**

```tsx
// features/pos/receipt/A4Invoice.tsx
"use client";

import { useTranslations } from "next-intl";
import { useSettings } from "@/lib/data/hooks/settings";
import type { ReceiptData } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { Barcode } from "./Barcode";

export function A4Invoice({ data }: { data: ReceiptData }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { txn, a4Layout: layout, location } = data;
  const tt = txn.totals;
  const labels = settings?.customLabels.payments ?? [];
  const sumRow = (label: string, value: string, bold = false) => (
    <tr className={bold ? "text-base font-semibold" : ""}>
      <td className="py-1 pr-6 text-right text-neutral-600">{label}</td>
      <td className="py-1 text-right tabular-nums">{value}</td>
    </tr>
  );

  return (
    <article className="mx-auto w-[186mm] bg-white p-8 text-[12px] text-neutral-900">
      <header className="flex items-start justify-between border-b pb-4">
        <div>
          {layout.showLogo && data.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logo} alt="" className="mb-2 h-12 object-contain" />
          )}
          <h1 className="text-xl font-bold">{data.businessName}</h1>
          <p>{location.name}</p>
          {location.mobile && <p>{location.mobile}</p>}
          {layout.headerText && <p className="mt-1 whitespace-pre-line text-neutral-600">{layout.headerText}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-light tracking-wide uppercase">{t(`status.${txn.status}`)}</p>
          <p className="mt-2">{`${t("pos.receipt.invoiceNo")}: ${txn.refNo}`}</p>
          <p>{`${t("pos.receipt.date")}: ${f.dateTime(txn.date)}`}</p>
          <p>{`${t("pos.receipt.cashier")}: ${data.cashier}`}</p>
          <Barcode value={txn.refNo} className="mt-2 ml-auto h-10 w-48" />
        </div>
      </header>
      {layout.showCustomer && (
        <section className="py-4">
          <p className="text-xs text-neutral-500 uppercase">{t("pos.receipt.customer")}</p>
          <p className="font-medium">{data.customer.name}</p>
          {data.customer.mobile && <p>{data.customer.mobile}</p>}
        </section>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y bg-neutral-50 text-left text-xs uppercase">
            <th className="py-2 pl-2">#</th>
            <th className="py-2">{t("pos.receipt.item")}</th>
            {layout.showSku && <th className="py-2">SKU</th>}
            <th className="py-2 text-right">{t("pos.receipt.qty")}</th>
            <th className="py-2 text-right">{t("pos.receipt.unitPrice")}</th>
            <th className="py-2 text-right">{t("pos.totals.discount")}</th>
            <th className="py-2 pr-2 text-right">{t("pos.receipt.total")}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="border-b align-top">
              <td className="py-2 pl-2">{f.number(i + 1)}</td>
              <td className="py-2">
                {l.name}
                {l.serials.length > 0 && <div className="text-[10px] text-neutral-500">{l.serials.join(", ")}</div>}
              </td>
              {layout.showSku && <td className="py-2">{l.sku}</td>}
              <td className="py-2 text-right tabular-nums">{`${f.qty(l.qty)} ${l.unitName}`}</td>
              <td className="py-2 text-right tabular-nums">{f.amount(l.unitPrice)}</td>
              <td className="py-2 text-right tabular-nums">{f.amount(l.discount)}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{f.amount(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between gap-8">
        {layout.showPaymentInfo ? (
          <table className="self-start text-sm">
            <tbody>
              {txn.payments.filter((p) => !p.isReturn).map((p) => (
                <tr key={p.id}>
                  <td className="py-0.5 pr-4">{methodLabel(p.method, t, labels)}</td>
                  <td className="py-0.5 pr-4 text-neutral-500">{f.date(p.paidOn)}</td>
                  <td className="py-0.5 text-right tabular-nums">{f.amount(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <span />}
        <table className="text-sm">
          <tbody>
            {sumRow(t("pos.totals.subtotal"), f.amount(tt.linesTotal))}
            {tt.discount > 0 && sumRow(`(−) ${t("pos.totals.discount")}`, f.amount(tt.discount))}
            {tt.orderTax > 0 && sumRow(`(+) ${t("pos.totals.orderTax")}`, f.amount(tt.orderTax))}
            {tt.shipping > 0 && sumRow(`(+) ${t("pos.totals.shipping")}`, f.amount(tt.shipping))}
            {tt.redeemed > 0 && sumRow(`(−) ${t("pos.totals.redeemed")}`, f.amount(tt.redeemed))}
            {tt.roundOff !== 0 && sumRow(t("pos.totals.roundOff"), f.amount(tt.roundOff))}
            {sumRow(t("pos.receipt.total"), f.money(tt.total), true)}
            {sumRow(t("pos.receipt.paid"), f.amount(data.paid))}
            {data.change > 0 && sumRow(t("pos.receipt.change"), f.amount(data.change))}
            {data.due > 0 && sumRow(t("pos.receipt.due"), f.money(data.due), true)}
          </tbody>
        </table>
      </div>
      {layout.footerText && <p className="mt-10 border-t pt-4 text-center whitespace-pre-line text-neutral-600">{layout.footerText}</p>}
    </article>
  );
}
```

- [ ] **Step 4: Print helper and CSS**

```ts
// features/pos/receipt/print.ts
"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

export type PrintKind = "thermal" | "a4";

/**
 * Renders the chosen layout into the print root synchronously, then opens the print dialog.
 * The root is cleared on `afterprint`.
 */
export function usePrint() {
  const [printing, setPrinting] = useState<PrintKind | null>(null);
  const print = (kind: PrintKind) => {
    flushSync(() => setPrinting(kind));
    window.addEventListener("afterprint", () => setPrinting(null), { once: true });
    window.print();
  };
  return { printing, print };
}
```

Append to `app/globals.css`:

```css
/* POS printing: only the [data-print-root] portal is printed. */
[data-print-root] { display: none; }
@page thermal { size: 80mm auto; margin: 0; }
@page a4 { size: A4; margin: 12mm; }
@media print {
  body > *:not([data-print-root]) { display: none !important; }
  [data-print-root] { display: block !important; }
  [data-print-root="thermal"] { page: thermal; }
  [data-print-root="a4"] { page: a4; }
  html, body { background: white !important; }
}
```

- [ ] **Step 5: Receipt modal**

```tsx
// features/pos/receipt/ReceiptModal.tsx
"use client";

import { createPortal } from "react-dom";
import { FileTextIcon, PlusIcon, PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReceipt } from "@/lib/data/hooks/pos";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { A4Invoice } from "./A4Invoice";
import { usePrint } from "./print";
import { ThermalReceipt } from "./ThermalReceipt";

export function ReceiptModal() {
  const t = useTranslations();
  const open = usePosDialogs((s) => s.open === "receipt");
  const receiptId = usePosDialogs((s) => s.receiptId);
  const hide = usePosDialogs((s) => s.hide);
  const { data } = useReceipt(open ? receiptId : null);
  const { printing, print } = usePrint();

  const close = () => {
    hide();
    focusSearch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("pos.receipt.title")}</DialogTitle>
          </DialogHeader>
          {!data ? (
            <Skeleton className="h-96" />
          ) : (
            <Tabs defaultValue="thermal">
              <TabsList>
                <TabsTrigger value="thermal">{t("pos.receipt.thermal")}</TabsTrigger>
                <TabsTrigger value="a4">{t("pos.receipt.a4")}</TabsTrigger>
              </TabsList>
              <TabsContent value="thermal" className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                <ThermalReceipt data={data} />
              </TabsContent>
              <TabsContent value="a4" className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                <div className="origin-top scale-[0.6]">
                  <A4Invoice data={data} />
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => print("a4")} disabled={!data}>
              <FileTextIcon />
              {t("pos.receipt.a4")}
            </Button>
            <Button variant="outline" onClick={() => print("thermal")} disabled={!data}>
              <PrinterIcon />
              {t("common.print")}
            </Button>
            <Button autoFocus onClick={close}>
              <PlusIcon />
              {t("pos.receipt.newSale")}
              <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Enter</kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printing && data &&
        createPortal(
          <div data-print-root={printing}>{printing === "thermal" ? <ThermalReceipt data={data} /> : <A4Invoice data={data} />}</div>,
          document.body,
        )}
    </>
  );
}
```

> "New sale" has `autoFocus`, so Enter closes the modal (spec § 3.6). The cart was already cleared by `useCheckout`.

- [ ] **Step 6: Mount, verify, commit**

In `PosScreen.tsx`, add `import { ReceiptModal } from "./receipt/ReceiptModal";` and `<ReceiptModal />` before `{/* slot:dialogs */}`.

Run `npm run typecheck && npm run lint`, then check in the browser:
- A cash sale shows the receipt with the right items, totals and change, and a barcode.
- Enter closes the modal and focus returns to search.
- Print opens the browser dialog; its preview shows only the 80mm receipt. A4 shows the full page.
- Recent → Print opens the same modal for an older invoice.
- In dark mode the receipt stays black on white.

```bash
git add features/pos app/globals.css
git commit -m "feat(pos): receipt modal with thermal and A4 layouts, Code128, print CSS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Keyboard shortcuts, weighing-scale dialog, cheat sheet

**Files:**
- Create: `features/pos/PosHotkeys.tsx`, `features/pos/dialogs/WeighingScale.tsx`, `features/pos/dialogs/Shortcuts.tsx`
- Modify: `features/pos/PosScreen.tsx` (`slot:dialogs`)

**Interfaces:**
- Consumes:
  - `useHotkeys`, `formatHotkey` (Task 2)
  - `usePosCommands` (Task 11), `usePosDialogs`, `focusSearch` (Task 7)
  - `usePosLookup` (Task 7), `useAddToCart` (Task 8), `parseScaleBarcode` (Task 2)
- Produces: `PosHotkeys({ location })`, `WeighingScaleDialog({ locationId })`, `ShortcutsDialog()`.

Rules (spec § 4):
- `F3` focuses search and `?` opens the cheat sheet. `Esc` is already handled by Radix for dialogs and sheets.
- Settings shortcuts are active only while no POS dialog is open. The payment dialog binds `addPaymentRow` and `finalizePayment` itself (Task 11).
- An empty setting string means "unbound".

- [ ] **Step 1: Hotkeys component**

```tsx
// features/pos/PosHotkeys.tsx
"use client";

import { useSettings } from "@/lib/data/hooks/settings";
import type { Location } from "@/lib/data/schemas";
import { useHotkeys } from "@/lib/pos/hotkeys";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "./dialogStore";
import { focusSearch } from "./focus";
import { usePosCommands } from "./usePosCommands";

/** Window-level POS shortcuts. Renders nothing. */
export function PosHotkeys({ location }: { location: Location }) {
  const { data: settings } = useSettings();
  const { cart } = useCart(location.id);
  const open = usePosDialogs((s) => s.open);
  const show = usePosDialogs((s) => s.show);
  const cmd = usePosCommands(location);
  const s = settings?.pos.shortcuts;
  const idle = open === null;

  useHotkeys({ f3: () => focusSearch(), "?": () => show("shortcuts") }, idle);
  useHotkeys(
    s
      ? {
          [s.expressCheckout]: cmd.express,
          [s.payAndCheckout]: () => cmd.pay("multiple"),
          [s.draft]: cmd.draft,
          [s.cancel]: cmd.cancel,
          [s.recentProductQty]: () => {
            const last = cart.lines.at(-1);
            const el = last && (document.getElementById(`pos-qty-${last.key}`) as HTMLInputElement | null);
            el?.focus();
            el?.select();
          },
          [s.weighingScale]: () => settings?.pos.enableWeighingScale && show("scale"),
          [s.editDiscount]: () => !settings?.pos.disableDiscount && cart.lines.length > 0 && show("discount"),
          [s.editOrderTax]: () => !settings?.pos.disableOrderTax && cart.lines.length > 0 && show("orderTax"),
          [s.addNewProduct]: () => window.open("/products/new", "_blank"),
        }
      : {},
    idle,
  );
  return null;
}
```

> `useHotkeys` iterates `Object.entries` and skips empty specs. Two unbound settings both collapse to the `""` key, which is fine because it's skipped.

- [ ] **Step 2: Weighing scale dialog**

```tsx
// features/pos/dialogs/WeighingScale.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePosLookup } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { parseScaleBarcode } from "@/lib/pos/scale";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { useAddToCart } from "../usePos";

function ScaleForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { cart } = useCart(locationId);
  const lookup = usePosLookup();
  const add = useAddToCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [code, setCode] = useState("");
  const parsed = settings && code.trim() ? parseScaleBarcode(code, settings.pos.weighingScale) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    const hit = (await lookup({ locationId, contactId: cart.contactId, term: parsed.sku })).find((h) => h.exact);
    if (!hit) return void toast.error(t("pos.search.noMatch", { term: parsed.sku }));
    if (add(hit.product, hit.variation, parsed.qty)) {
      hide();
      focusSearch();
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.scale.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="scale-code">{t("pos.scale.barcode")}</Label>
        <Input id="scale-code" autoFocus autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {code.trim() && (parsed ? t("pos.scale.parsed", { sku: parsed.sku, qty: f.qty(parsed.qty) }) : t("pos.scale.invalid"))}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!parsed}>{t("common.add")}</Button>
      </DialogFooter>
    </form>
  );
}

export function WeighingScaleDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "scale");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-sm">{open && <ScaleForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Shortcuts cheat sheet**

```tsx
// features/pos/dialogs/Shortcuts.tsx
"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSettings } from "@/lib/data/hooks/settings";
import { formatHotkey } from "@/lib/pos/hotkeys";
import { usePosDialogs } from "../dialogStore";

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</kbd>
);

export function ShortcutsDialog() {
  const t = useTranslations("pos.shortcuts");
  const open = usePosDialogs((s) => s.open === "shortcuts");
  const hide = usePosDialogs((s) => s.hide);
  const { data: settings } = useSettings();
  const map = settings?.pos.shortcuts;
  const rows: [string, string][] = [
    [t("focusSearch"), "F3"],
    [t("help"), "?"],
    ...(map ? (Object.entries(map) as [keyof typeof map, string][]).map(([k, v]): [string, string] => [t(k), v ? formatHotkey(v) : ""]) : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, keys]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-2">{label}</td>
                <td className="py-2 text-right">{keys ? <Kbd>{keys}</Kbd> : <span className="text-muted-foreground">{t("unset")}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
```

> Every key of `settings.pos.shortcuts` has a message under `pos.shortcuts.*` (Task 0), so `t(k)` is typed-safe at runtime. If next-intl's typed keys complain, cast: `t(k as "draft")`.

- [ ] **Step 4: Mount, verify, commit**

In `PosScreen.tsx`, import the three components and add before `{/* slot:dialogs */}`:

```tsx
          <PosHotkeys location={location!} />
          <WeighingScaleDialog locationId={location!.id} />
```

The top-bar Shortcuts button also works on the register gate, so mount `<ShortcutsDialog />` **outside** the `ready &&` block, directly after the main layout's closing `</div>`.

Run `npm run typecheck && npm run lint`, then check in the browser:
- `?` (outside inputs) opens the cheat sheet, showing Shift + E and the other seeded bindings.
- F3 from anywhere focuses search.
- With items in the cart, Shift+E (even while typing in search) completes a cash sale.
- Shift+D saves a draft and Shift+C asks to cancel.
- F2 focuses the last row's qty.
- Inside Payment, Shift+R adds a row and Shift+F finalizes.
- Enable the weighing scale in settings (prefix "21") and bind it. The scale dialog parses `2100001002500` into the SKU and quantity from settings, then adds the item.

```bash
git add features/pos
git commit -m "feat(pos): keyboard shortcuts, weighing-scale entry, shortcuts cheat sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Final verification and smoke test

**Files:**
- No new files. Fixes go wherever the checks point.

- [ ] **Step 1: Static checks**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
Expected: all green. The build output lists `/pos` as a static route.

- [ ] **Step 2: Playwright smoke (spec § 7)**

Start `npx next dev -p 3100`, then use the Playwright MCP tools at 1366×800:
1. Log in as `admin` / `112233`, then go to `/pos`.
2. Open the register with 1000.
3. Type the SKU of a stocked single product into search and press Enter. The row appears.
4. Click a grid card for a second product.
5. Click **Multiple pay**. Set the cash row to half the total, add a bKash row for the rest with txn ID `TX1`, then Finalize.
6. The receipt modal shows the invoice number. Press Enter; the cart is empty.
7. Open Recent → Final; the invoice is listed.
8. Suspend a one-item sale, resume it from Suspended, then pay by Cash.
9. Open `/products`. The first product's stock at the location is lower by 1.
10. Back on `/pos`, Close register with counted = expected. The gate returns.
11. Switch to Bangla and dark mode and take a screenshot. Text is Bangla, digits are Bangla, and the layout doesn't overflow.
12. Resize to 900px wide. The narrow notice shows.

Save screenshots to the scratchpad, not the repo.

- [ ] **Step 3: Clean up**

```bash
pkill -f "next dev"; rm -rf .playwright-mcp
git status --short
```
Expected: only intended changes. Commit any fixes found in Steps 1–2:

```bash
git add -A features lib app messages scripts
git commit -m "fix(pos): smoke-test fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Skip the commit when there is nothing to fix.)
