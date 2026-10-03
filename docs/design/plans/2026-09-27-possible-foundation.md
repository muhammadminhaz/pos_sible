# pos_sible Foundation Implementation Plan

**Goal:** Build the foundation for the pos_sible frontend. It covers:
- design tokens, fonts, and theming (light/dark)
- EN/BN i18n
- a tested pure domain layer
- Zod schemas, a deterministic Bangladeshi seed, and persisted Zustand stores behind async services and TanStack Query hooks
- mock auth and permissions
- the app shell (sidebar, header, ⌘K)
- shared UI (DataTable, FilterBar, PageHeader, …)
- every route scaffolded
- a working Products list as the reference screen

**Architecture:** Next 16 App Router. Layouts are Server Components that render the frame, and screens are Client Components. All data comes from localStorage-persisted Zustand stores, accessed only through `lib/data/services` (async) and `lib/data/hooks` (TanStack Query). Business math lives in pure `lib/domain` modules with Vitest coverage.

**Tech Stack:** Next.js 16.3, React 19.2, Tailwind v4, shadcn/ui (Radix), @tanstack/react-table@8, @tanstack/react-query@5, react-hook-form@7 + zod@4, zustand@5, next-intl@4, next-themes, recharts@3, lucide-react, cmdk, sonner, date-fns@4, vitest.

**Spec:** `docs/design/specs/2026-09-27-possible-foundation-design.md`

## Global Constraints
- Read `node_modules/next/dist/docs/` before using any Next API. Middleware is now `proxy.ts`, and this plan uses no proxy.
- No backend. All persistence goes through localStorage keys `posible:v1:<store>`.
- UI never imports stores directly. It only uses `lib/data/hooks/*`.
- Money is a `number` in major units (BDT). Round with `roundMoney()` from `lib/domain/money.ts`.
- Every user-visible string comes from `messages/{en,bn}.json`.
- Accent colour `oklch(0.55 0.2 275)`, base font 14px, radius 8px for controls and 12px for cards.
- Pin `@tanstack/react-table@^8`.
- Commit after each task.

---

## File map

```
vitest.config.ts
components.json                     shadcn config
app/globals.css                     tokens + base styles
app/layout.tsx                      fonts, Providers
app/providers.tsx                   Theme, Intl(client), Query, Toaster, TooltipProvider
app/page.tsx                        redirect("/home")
app/(auth)/login/page.tsx
app/(app)/layout.tsx                AppShell + AuthGuard
app/(app)/**/page.tsx               every route in spec §3.3 (placeholders unless built)
app/(app)/error.tsx, not-found.tsx
app/(pos)/layout.tsx, pos/page.tsx  placeholder frame
i18n/request.ts                     next-intl cookie locale
messages/en.json, bn.json
lib/i18n/locale.ts                  setLocale server action
lib/i18n/format.ts                  useFormat()
lib/domain/money.ts, totals.ts, payments.ts, units.ts, pricing.ts, discounts.ts,
           stock.ts, refs.ts, rewards.ts, commission.ts   (+ *.test.ts)
lib/data/schemas/*.ts               Zod schemas
lib/data/seed/rng.ts, names.ts, catalog.ts, index.ts   (+ seed.test.ts)
lib/data/store/db.ts                single persisted Zustand store (all tables) + commit()
lib/data/services/*.ts              products, contacts, catalog, settings, auth, lookups
lib/data/hooks/*.ts                 query hooks
lib/data/errors.ts
lib/auth/permissions.ts, session.ts, AuthGuard.tsx, useCan.ts
lib/nav.ts                          nav tree (labels are i18n keys, icons, href, permission)
components/ui/*                     shadcn primitives
components/layout/*                 AppShell, Sidebar, Header, CommandPalette, LocaleToggle,
                                    ThemeToggle, LocationSwitcher, Calculator, ProfitPopover,
                                    UserMenu, Breadcrumbs
components/shared/*                 PageHeader, StatCard, StatusBadge, Money, EmptyState,
                                    ComingSoon, DataTable/*, FilterBar/*, DateRangePicker
features/products/ProductsList.tsx, columns.tsx
```

**Deviation from spec §5.2, recorded here:** a single persisted store `db` holds all tables, instead of one store per aggregate. Atomic multi-table `commit()` is trivial that way, and it still has one versioned key, `posible:v1:db`. The session and UI preferences are separate small stores (`posible:v1:session`, `posible:v1:ui`).

---

### Task 1: Tooling and dependencies

**Files:** Modify `package.json`, `tsconfig.json`. Create `vitest.config.ts` and `components.json` (via the shadcn CLI).

- [ ] Install the runtime dependencies:
  `npm i next-intl next-themes zustand @tanstack/react-query @tanstack/react-table@^8 react-hook-form @hookform/resolvers zod recharts lucide-react cmdk sonner date-fns clsx tailwind-merge class-variance-authority`
- [ ] Install the dev dependencies: `npm i -D vitest @vitest/coverage-v8 vite-tsconfig-paths`
- [ ] Run `npx shadcn@latest init -d -b neutral`. Then run `npx shadcn@latest add button input label select textarea checkbox switch radio-group dialog sheet dropdown-menu popover tooltip tabs badge card separator skeleton scroll-area avatar command calendar table breadcrumb collapsible alert-dialog toggle-group sonner progress`
- [ ] Create `vitest.config.ts`:
  ```ts
  import { defineConfig } from "vitest/config";
  import tsconfigPaths from "vite-tsconfig-paths";
  export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: ["lib/**/*.test.ts"] } });
  ```
- [ ] In `package.json` scripts, add `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`.
- [ ] Run `npm run typecheck && npm run build`. Expected: success.
- [ ] Commit: `chore: add dependencies, shadcn and vitest`.

### Task 2: Domain — money and totals (TDD)

**Files:** `lib/domain/money.ts`, `lib/domain/totals.ts`, and tests.

**Interfaces (produces):**
```ts
export type RoundingMode = "none" | "whole" | "0.05" | "0.1" | "0.5";
export function roundMoney(n: number, precision?: number): number;          // default 2, half-up
export function applyRounding(n: number, mode: RoundingMode): { total: number; roundOff: number };
export type DiscountInput = { type: "fixed" | "percentage"; amount: number };
export type LineInput = { qty: number; unitPrice: number; taxRate: number; taxType: "inclusive" | "exclusive"; discount?: DiscountInput };
export type LineTotals = { unitExc: number; unitInc: number; unitTax: number; discountPerUnit: number; netUnitInc: number; subtotal: number; tax: number };
export function lineTotals(l: LineInput): LineTotals;
export type OrderInput = { lines: LineInput[]; discount?: DiscountInput; orderTaxRate?: number; shipping?: number; additionalExpenses?: number[]; rounding?: RoundingMode; pointsRedeemed?: number };
export type OrderTotals = { itemsCount: number; linesTotal: number; discount: number; orderTax: number; shipping: number; additional: number; redeemed: number; roundOff: number; total: number };
export function orderTotals(o: OrderInput): OrderTotals;
```

Rules:
- For a line, `unitPrice` is exc tax when `taxType` is "exclusive" and inc tax when it's "inclusive".
- The line discount applies to the exc-tax unit price.
- `subtotal = netUnitInc * qty`.
- The order discount applies to `linesTotal`. Order tax is `(linesTotal - discount) * rate/100`.
- `total = linesTotal - discount + orderTax + shipping + additional - redeemed`, then rounding applies.

- [ ] Write the tests in `lib/domain/totals.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import { roundMoney, applyRounding } from "./money";
  import { lineTotals, orderTotals } from "./totals";
  describe("money", () => {
    it("rounds half up", () => { expect(roundMoney(1.005)).toBe(1.01); expect(roundMoney(2.344)).toBe(2.34); });
    it("rounding modes", () => {
      expect(applyRounding(10.37, "whole")).toEqual({ total: 10, roundOff: -0.37 });
      expect(applyRounding(10.37, "0.05")).toEqual({ total: 10.35, roundOff: -0.02 });
      expect(applyRounding(10.37, "0.5")).toEqual({ total: 10.5, roundOff: 0.13 });
      expect(applyRounding(10.37, "none")).toEqual({ total: 10.37, roundOff: 0 });
    });
  });
  describe("lineTotals", () => {
    it("exclusive tax", () => {
      const t = lineTotals({ qty: 2, unitPrice: 100, taxRate: 5, taxType: "exclusive" });
      expect(t).toMatchObject({ unitExc: 100, unitTax: 5, unitInc: 105, subtotal: 210, tax: 10 });
    });
    it("inclusive tax back-calculates", () => {
      const t = lineTotals({ qty: 1, unitPrice: 105, taxRate: 5, taxType: "inclusive" });
      expect(t.unitExc).toBe(100); expect(t.subtotal).toBe(105);
    });
    it("percentage line discount on exc price", () => {
      const t = lineTotals({ qty: 1, unitPrice: 200, taxRate: 0, taxType: "exclusive", discount: { type: "percentage", amount: 10 } });
      expect(t.subtotal).toBe(180);
    });
  });
  describe("orderTotals", () => {
    it("combines discount, tax, shipping, rounding", () => {
      const o = orderTotals({ lines: [{ qty: 3, unitPrice: 33.33, taxRate: 0, taxType: "exclusive" }], discount: { type: "fixed", amount: 10 }, orderTaxRate: 5, shipping: 60, additionalExpenses: [5], rounding: "whole" });
      // lines 99.99, -10 = 89.99, tax 4.50, +60 +5 = 159.49 → 159
      expect(o).toMatchObject({ linesTotal: 99.99, discount: 10, orderTax: 4.5, total: 159, roundOff: -0.49, itemsCount: 3 });
    });
  });
  ```
- [ ] Run `npx vitest run lib/domain/totals.test.ts`. Expected: FAIL (the module doesn't exist yet).
- [ ] Implement `money.ts`:
  - `roundMoney` uses `Math.round((n + Number.EPSILON) * 10**p) / 10**p`.
  - `applyRounding` uses step = {whole:1, "0.05":0.05, "0.1":0.1, "0.5":0.5}, computes `total = roundMoney(Math.round(n/step)*step)`, and returns `roundOff = roundMoney(total-n)`.
- [ ] Implement `totals.ts` following the rules above, and round each stored figure.
- [ ] Run the tests again. Expected: PASS.
- [ ] Commit: `feat(domain): money rounding and order totals`.

### Task 3: Domain — payments, units, pricing, discounts (TDD)

**Interfaces (produces):**
```ts
// payments.ts
export type PaymentStatus = "paid" | "partial" | "due" | "overdue";
export function paymentSummary(total: number, payments: { amount: number; isReturn?: boolean }[]): { paid: number; due: number; change: number };
export function paymentStatus(args: { total: number; paid: number; date: string; payTerm?: { number: number; type: "days" | "months" }; today?: string }): PaymentStatus;
// units.ts
export type UnitLike = { id: string; baseUnitId?: string | null; multiplier?: number | null };
export function toBaseQty(qty: number, unit: UnitLike): number;
// pricing.ts
export function sellPriceFromMargin(purchaseExc: number, marginPct: number): number;
export function marginFromPrices(purchaseExc: number, sellExc: number): number;
export function resolveUnitPrice(args: { defaultPrice: number; groupPrices?: Record<string, number>; priceGroupId?: string | null; customerGroup?: { calcType: "percentage" | "selling_price_group"; amount: number; priceGroupId?: string | null } | null }): number;
// discounts.ts
export type DiscountRule = { id: string; name: string; active: boolean; locationId: string | null; productIds: string[]; brandId: string | null; categoryId: string | null; priority: number; type: "fixed" | "percentage"; amount: number; startsAt: string; endsAt: string };
export function findDiscount(rules: DiscountRule[], ctx: { productId: string; brandId?: string | null; categoryId?: string | null; locationId: string; at: string }): DiscountRule | null;
```

Rules:
- `paymentSummary`: paid is the sum of non-return amounts. Change is `max(0, paid - total)`, and due is `max(0, total - paid)`.
- `paymentStatus`:
  - `paid` when due is ≤ 0.
  - Otherwise `overdue` if the pay term exists and `date + term` < today.
  - Otherwise `partial` if paid > 0, else `due`.
- `resolveUnitPrice`:
  - The customer group with `selling_price_group` uses that group's price, if present.
  - A `percentage` group adds `amount%` to the price (it can be negative).
  - Otherwise the location `priceGroupId` price applies, falling back to the default.
- `findDiscount`: a rule matches when it's active, the time is within [startsAt, endsAt], the location matches (or the rule has no location), and the product is in `productIds`, or the brand matches (when a brand is set), or the category matches (when a category is set). Pick the highest priority.

- [ ] Write the tests `lib/domain/payments.test.ts`, `units.test.ts`, `pricing.test.ts`, `discounts.test.ts`:
  ```ts
  // payments.test.ts
  import { describe, it, expect } from "vitest";
  import { paymentSummary, paymentStatus } from "./payments";
  describe("payments", () => {
    it("summary with change", () => { expect(paymentSummary(95, [{ amount: 100 }])).toEqual({ paid: 100, due: 0, change: 5 }); });
    it("status", () => {
      expect(paymentStatus({ total: 100, paid: 100, date: "2026-01-01" })).toBe("paid");
      expect(paymentStatus({ total: 100, paid: 40, date: "2026-01-01" })).toBe("partial");
      expect(paymentStatus({ total: 100, paid: 0, date: "2026-01-01" })).toBe("due");
      expect(paymentStatus({ total: 100, paid: 0, date: "2026-01-01", payTerm: { number: 10, type: "days" }, today: "2026-02-01" })).toBe("overdue");
    });
  });
  // units.test.ts
  import { toBaseQty } from "./units";
  it("converts sub unit", () => { expect(toBaseQty(2, { id: "bag", baseUnitId: "kg", multiplier: 50 })).toBe(100); expect(toBaseQty(3, { id: "pc" })).toBe(3); });
  // pricing.test.ts
  import { sellPriceFromMargin, marginFromPrices, resolveUnitPrice } from "./pricing";
  it("margin", () => { expect(sellPriceFromMargin(100, 25)).toBe(125); expect(marginFromPrices(80, 100)).toBe(25); });
  it("price groups", () => {
    expect(resolveUnitPrice({ defaultPrice: 100, groupPrices: { w: 90 }, priceGroupId: "w" })).toBe(90);
    expect(resolveUnitPrice({ defaultPrice: 100, customerGroup: { calcType: "percentage", amount: -5 } })).toBe(95);
    expect(resolveUnitPrice({ defaultPrice: 100, groupPrices: { d: 80 }, customerGroup: { calcType: "selling_price_group", amount: 0, priceGroupId: "d" } })).toBe(80);
  });
  // discounts.test.ts
  import { findDiscount, type DiscountRule } from "./discounts";
  const base: DiscountRule = { id: "a", name: "A", active: true, locationId: null, productIds: [], brandId: null, categoryId: "c1", priority: 1, type: "percentage", amount: 5, startsAt: "2026-01-01", endsAt: "2026-12-31" };
  it("picks highest priority matching rule", () => {
    const rules = [base, { ...base, id: "b", priority: 5, productIds: ["p1"], categoryId: null }];
    expect(findDiscount(rules, { productId: "p1", categoryId: "c1", locationId: "l1", at: "2026-06-01" })?.id).toBe("b");
    expect(findDiscount(rules, { productId: "p2", categoryId: "c1", locationId: "l1", at: "2026-06-01" })?.id).toBe("a");
    expect(findDiscount(rules, { productId: "p2", categoryId: "c9", locationId: "l1", at: "2026-06-01" })).toBeNull();
    expect(findDiscount([{ ...base, endsAt: "2026-02-01" }], { productId: "p2", categoryId: "c1", locationId: "l1", at: "2026-06-01" })).toBeNull();
  });
  ```
  (Each file imports `describe/it/expect` from vitest.)
- [ ] Run the tests. Expected: FAIL.
- [ ] Implement the four modules using date-fns `addDays`, `addMonths`, and `isAfter`.
- [ ] Run the tests. Expected: PASS.
- [ ] Commit: `feat(domain): payments, units, pricing, discounts`.

### Task 4: Domain — stock allocation, refs, rewards, commission (TDD)

**Interfaces (produces):**
```ts
// stock.ts
export type Lot = { id: string; locationId: string; variationId: string; qtyRemaining: number; unitCost: number; receivedAt: string; expDate?: string | null };
export type Allocation = { lotId: string; qty: number; unitCost: number };
export function allocate(lots: Lot[], args: { variationId: string; locationId: string; qty: number; method: "fifo" | "lifo"; allowOverselling?: boolean }): { allocations: Allocation[]; shortfall: number; cost: number };
export function available(lots: Lot[], variationId: string, locationId?: string): number;
export type ExpiryState = "expired" | "expiring" | "ok" | "none";
export function expiryState(expDate: string | null | undefined, today: string, alertDays: number): ExpiryState;
// refs.ts
export function nextRef(prefix: string, year: number, seq: number, digits?: number): string; // "PO2026/0007"
export function nextInvoiceNo(scheme: { prefix: string; startFrom: number; count: number; digits: number; numberingType: "sequential" | "random" }, rand?: () => number): string;
// rewards.ts
export type RewardSettings = { enabled: boolean; amountForUnitPoint: number; minOrderTotalToEarn: number; maxPointsPerOrder: number | null; redeemAmountPerPoint: number; minOrderTotalToRedeem: number; minRedeemPoint: number; maxRedeemPoint: number | null };
export function pointsEarned(total: number, s: RewardSettings): number;
export function maxRedeemable(args: { total: number; balance: number; s: RewardSettings }): number;
export function redeemValue(points: number, s: RewardSettings): number;
// commission.ts
export function commission(args: { percent: number; basis: "invoice_value" | "payment_received"; invoiceTotal: number; paid: number }): number;
```

Rules:
- `allocate` sorts lots by `receivedAt` (ascending for FIFO, descending for LIFO) and takes from lots that have remaining qty.
  - If there's a shortfall and overselling is allowed, the remainder goes to `lotId: "oversell"` at the cost of the last lot used (or 0).
  - If there's a shortfall and overselling isn't allowed, the result reports the `shortfall` and allocates nothing for the missing qty.
- `expiryState`: `none` when there's no date. `expired` when the date is before today. `expiring` when it's within `alertDays`. Otherwise `ok`.
- `nextInvoiceNo`, sequential: `prefix + String(startFrom+count).padStart(digits,"0")`. Random: `prefix + ` a random number with `digits` digits.
- `pointsEarned`: 0 if disabled or total < min. Otherwise `floor(total / amountForUnitPoint)`, capped at the max.
- `maxRedeemable`: 0 if total < minOrderTotalToRedeem, or if the balance is below minRedeemPoint. Otherwise `min(balance, maxRedeemPoint ?? ∞, floor(total / redeemAmountPerPoint))`.

- [ ] Write the tests:
  ```ts
  // stock.test.ts
  import { describe, it, expect } from "vitest";
  import { allocate, available, expiryState, type Lot } from "./stock";
  const lots: Lot[] = [
    { id: "a", locationId: "l1", variationId: "v", qtyRemaining: 5, unitCost: 10, receivedAt: "2026-01-01" },
    { id: "b", locationId: "l1", variationId: "v", qtyRemaining: 5, unitCost: 12, receivedAt: "2026-02-01" },
    { id: "c", locationId: "l2", variationId: "v", qtyRemaining: 9, unitCost: 11, receivedAt: "2026-01-15" },
  ];
  describe("stock", () => {
    it("fifo", () => { const r = allocate(lots, { variationId: "v", locationId: "l1", qty: 7, method: "fifo" }); expect(r.allocations).toEqual([{ lotId: "a", qty: 5, unitCost: 10 }, { lotId: "b", qty: 2, unitCost: 12 }]); expect(r.cost).toBe(74); expect(r.shortfall).toBe(0); });
    it("lifo", () => { expect(allocate(lots, { variationId: "v", locationId: "l1", qty: 7, method: "lifo" }).cost).toBe(80); });
    it("shortfall", () => { expect(allocate(lots, { variationId: "v", locationId: "l1", qty: 12, method: "fifo" }).shortfall).toBe(2); });
    it("oversell", () => { const r = allocate(lots, { variationId: "v", locationId: "l1", qty: 12, method: "fifo", allowOverselling: true }); expect(r.shortfall).toBe(0); expect(r.allocations.at(-1)).toEqual({ lotId: "oversell", qty: 2, unitCost: 12 }); });
    it("available", () => { expect(available(lots, "v", "l1")).toBe(10); expect(available(lots, "v")).toBe(19); });
    it("expiry", () => { expect(expiryState("2026-01-01", "2026-02-01", 30)).toBe("expired"); expect(expiryState("2026-02-10", "2026-02-01", 30)).toBe("expiring"); expect(expiryState("2026-06-10", "2026-02-01", 30)).toBe("ok"); expect(expiryState(null, "2026-02-01", 30)).toBe("none"); });
  });
  // refs.test.ts
  import { nextRef, nextInvoiceNo } from "./refs";
  it("refs", () => { expect(nextRef("PO", 2026, 7)).toBe("PO2026/0007"); expect(nextInvoiceNo({ prefix: "INV-", startFrom: 1, count: 41, digits: 5, numberingType: "sequential" })).toBe("INV-00042"); expect(nextInvoiceNo({ prefix: "R", startFrom: 1, count: 0, digits: 4, numberingType: "random" }, () => 0.5)).toMatch(/^R\d{4}$/); });
  // rewards.test.ts
  import { pointsEarned, maxRedeemable, redeemValue, type RewardSettings } from "./rewards";
  const s: RewardSettings = { enabled: true, amountForUnitPoint: 100, minOrderTotalToEarn: 200, maxPointsPerOrder: 20, redeemAmountPerPoint: 1, minOrderTotalToRedeem: 100, minRedeemPoint: 10, maxRedeemPoint: 50 };
  it("rewards", () => { expect(pointsEarned(150, s)).toBe(0); expect(pointsEarned(950, s)).toBe(9); expect(pointsEarned(5000, s)).toBe(20); expect(maxRedeemable({ total: 500, balance: 80, s })).toBe(50); expect(maxRedeemable({ total: 500, balance: 5, s })).toBe(0); expect(redeemValue(30, s)).toBe(30); });
  // commission.test.ts
  import { commission } from "./commission";
  it("commission", () => { expect(commission({ percent: 2, basis: "invoice_value", invoiceTotal: 1000, paid: 500 })).toBe(20); expect(commission({ percent: 2, basis: "payment_received", invoiceTotal: 1000, paid: 500 })).toBe(10); });
  ```
- [ ] Run the tests. Expected: FAIL. Implement them. Run again. Expected: PASS.
- [ ] Commit: `feat(domain): stock allocation, refs, rewards, commission`.

### Task 5: Zod schemas

**Files:** `lib/data/schemas/{common,org,contacts,catalog,transactions,accounts,settings,misc,index}.ts`

**Produces:** a Zod schema and inferred type for every entity in spec §5.1. The exported types are `Business`, `Settings`, `Location`, `User`, `Role`, `Contact`, `CustomerGroup`, `Technician`, `Product`, `Variation`, `VariationTemplate`, `Unit`, `Category`, `Brand`, `Warranty`, `PriceGroup`, `TaxRate`, `StockLot`, `TxnLine`, `Payment`, `Transaction` (with `TxnType` = purchase | purchase_return | sell | sell_return | sales_order | stock_transfer | stock_adjustment | expense), `Account`, `AccountType`, `AccountTxn`, `Discount`, `InvoiceScheme`, `InvoiceLayout`, `BarcodeSetting`, `Printer`, `CashRegister`, `ExpenseCategory`, `ImportBatch`, `Notification`. There's also a `DB` type: `{ [table]: Entity[] }` plus `settings: Settings`.

Every entity extends `base = { id: z.string(), createdAt: z.string(), createdBy: z.string().nullable() }`.

`Settings` groups fields by tab: `business`, `tax`, `product`, `contact`, `sale`, `pos`, `purchase`, `payment`, `dashboard`, `system`, `prefixes`, `email`, `sms`, `rewards`, `modules`, `customLabels`. Field names are camelCase.

- [ ] Write the schemas. `index.ts` re-exports them and defines `export type TableName = keyof Omit<DB, "settings">`.
- [ ] Run `npm run typecheck`. Expected: PASS.
- [ ] Commit: `feat(data): zod schemas for all entities`.

### Task 6: Deterministic seed

**Files:** `lib/data/seed/{rng,names,catalog,history,index}.ts`, `lib/data/seed/seed.test.ts`

**Produces:** `export function createSeed(opts?: { seed?: number; today?: string }): DB`, with `seed` defaulting to 42 and `today` defaulting to the current date.
- `rng.ts`: `mulberry32(seed)` with helpers `int(a,b)`, `pick(arr)`, `chance(p)`, `money(a,b)`.
- `names.ts`: Bangladeshi first and last names, business names, Dhaka-area addresses, and 01XXXXXXXXX mobile numbers.
- `catalog.ts`:
  - units: Pieces, KG, Bag (=50 KG), Box, Pack, Dram (=185 KG), Set, Litre
  - ~14 categories with subcategories
  - ~20 brands
  - ~120 products, including 8 variable products (Size/Color) and 3 combos
  - 2 locations: `BL0001` Rango Electronics and `BL0003` Nipun Poultry & Fish Feed
- The rest of the seed:
  - users `admin` (Admin) and `cashier` (Cashier), plus 6 staff; 3 roles
  - ~60 contacts (20 suppliers, 38 customers, 2 both), with "Walk-In Customer" as `id: "walk-in"`
  - 4 customer groups, 3 technicians, 2 price groups (Wholesale, Dealer)
  - tax rates VAT 5%, VAT 7.5%, and AIT 2%, plus the group "VAT+AIT"
  - accounts Cash, bKash, Nagad, and City Bank; expense categories
  - invoice schemes Default and Secondary; layouts Classic, Compact receipt, and A4 detailed
  - the standard barcode presets; 1 printer; 3 discounts
- `history.ts` covers the 180 days before `today`:
  - purchases (received) create StockLots
  - sales (POS and web; 85% final, the rest draft or quotation) allocate FIFO, payments are split across cash, card, bKash, and Nagad, and payment status is computed with the domain functions
  - about 3% of sales get sell returns, and there are 10 purchase returns
  - 15 transfers, 12 adjustments, ~90 expenses, some recurring
  - registers are closed daily per cashier
  - all totals use `orderTotals`
- [ ] Write the test:
  ```ts
  import { describe, it, expect } from "vitest";
  import { createSeed } from "./index";
  describe("seed", () => {
    const db = createSeed({ seed: 42, today: "2026-09-27" });
    it("is deterministic", () => { expect(JSON.stringify(createSeed({ seed: 42, today: "2026-09-27" }))).toBe(JSON.stringify(db)); });
    it("has volumes", () => {
      expect(db.locations).toHaveLength(2);
      expect(db.products.length).toBeGreaterThanOrEqual(100);
      expect(db.transactions.filter(t => t.type === "sell").length).toBeGreaterThan(600);
      expect(db.transactions.filter(t => t.type === "purchase").length).toBeGreaterThan(80);
      expect(db.contacts.find(c => c.id === "walk-in")).toBeTruthy();
    });
    it("stock never negative", () => { expect(db.stockLots.every(l => l.qtyRemaining >= 0)).toBe(true); });
    it("final sales totals match lines", () => {
      for (const t of db.transactions.filter(t => t.type === "sell" && t.status === "final").slice(0, 50)) expect(t.totals.total).toBeGreaterThan(0);
    });
  });
  ```
- [ ] Run it. Expected: FAIL. Implement the seed. Run it again. Expected: PASS, in under 3 seconds.
- [ ] Commit: `feat(data): deterministic bangladeshi seed`.

### Task 7: Store, errors, services, query hooks

**Files:**
- `lib/data/store/db.ts`, `lib/data/store/ui.ts`
- `lib/data/errors.ts`
- `lib/data/services/{_util,products,contacts,catalog,settings,lookups,backup,dashboard}.ts`
- `lib/data/hooks/{keys,products,contacts,catalog,settings,lookups,dashboard}.ts`
- `lib/data/services/products.test.ts`

**Produces:**
```ts
// store/db.ts
export const useDB: UseBoundStore<StoreApi<{ db: DB; hydrated: boolean }>>;   // persist key "posible:v1:db"
export function getDB(): DB;
export function commit(mutator: (draft: DB) => void): void;   // structuredClone → mutate → set
export function resetDB(db?: DB): void;
// store/ui.ts: { sidebarCollapsed, openGroups: string[], density: "comfortable"|"compact", locationId: string|"all", tablePrefs: Record<string, {hidden: string[]; pageSize: number}> } + setters; key "posible:v1:ui"
// errors.ts
export class AppError extends Error { code: string }
export class ValidationError extends AppError { fields: Record<string,string> }
export class InsufficientStockError extends AppError { productName: string; available: number }
export class CreditLimitError extends AppError {}; export class EditWindowExpiredError extends AppError {}; export class NotFoundError extends AppError {};
// services/_util.ts
export const delay: () => Promise<void>;     // 0-150ms
export type ListQuery = { search?: string; page?: number; pageSize?: number; sort?: { id: string; desc: boolean } };
export type ListResult<T> = { rows: T[]; total: number };
export function paginate<T>(rows: T[], q: ListQuery): ListResult<T>;
export function uid(prefix: string): string;
// services/products.ts
export type ProductRow = Product & { unitName: string; categoryName?: string; brandName?: string; taxName?: string; locationNames: string[]; stock: number; purchasePrice: number; sellPrice: number; variations: Variation[] };
export type ProductFilters = ListQuery & { type?: Product["type"]; categoryId?: string; brandId?: string; unitId?: string; taxId?: string; locationId?: string; active?: "active"|"inactive"; notForSale?: boolean };
export const productsService: { list(f: ProductFilters): Promise<ListResult<ProductRow>>; get(id: string): Promise<ProductRow>; setActive(ids: string[], active: boolean): Promise<void>; remove(ids: string[]): Promise<void>; setLocations(ids: string[], locationIds: string[], mode: "add"|"remove"): Promise<void> };
// services/catalog.ts: generic CRUD factory
export function crud<T extends { id: string }>(table: TableName): { list(q?: ListQuery): Promise<ListResult<T>>; all(): Promise<T[]>; get(id: string): Promise<T>; create(data: Omit<T,"id"|"createdAt"|"createdBy">): Promise<T>; update(id: string, patch: Partial<T>): Promise<T>; remove(id: string): Promise<void> };
// services/lookups.ts: lookups.all() → { locations, units, categories, brands, taxRates, users, customerGroups, priceGroups, accounts, expenseCategories }
// services/dashboard.ts: dashboardService.kpis({ locationId, from, to }) → { totalSales, net, invoiceDue, sellReturn, totalPurchase, purchaseDue, purchaseReturn, expense }
// services/backup.ts: exportJSON(): string; importJSON(s): void; reset(): void
// hooks: useProducts(f), useProduct(id), useProductMutations(), useLookups(), useCrud<T>(table), useDashboardKpis(f)
```
Hooks wrap the services with `useQuery({ queryKey: keys.products.list(f), queryFn })`. Mutations call `queryClient.invalidateQueries({ queryKey: [table] })`.

Hydration:
- `useDB` uses `persist` with `skipHydration: true`. A `DataGate` component calls `useDB.persist.rehydrate()` on mount.
- If rehydration returns no data, the gate sets `createSeed()`.
- `hydrated` flips to true when this finishes.

- [ ] Write `products.test.ts`, which resets to `createSeed({seed:42,today:"2026-09-27"})` before each test:
  - `list({ search: <first product name> })` returns that product first
  - `list({ pageSize: 10 })` returns 10 rows with a correct total
  - `setActive([id], false)` makes it appear in the `active:"inactive"` filter
  - `stock` equals the sum of that product's lots
- [ ] Run it. Expected: FAIL. Implement the store (it needs a storage guard for the node test environment, falling back to in-memory when `typeof window === "undefined"`), the errors, the services, and the hooks. Run it again. Expected: PASS.
- [ ] Commit: `feat(data): persisted db store, services and query hooks`.

### Task 8: Design tokens, fonts, i18n, providers

**Files:** `app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `i18n/request.ts`, `next.config.ts`, `messages/en.json`, `messages/bn.json`, `lib/i18n/locale.ts`, `lib/i18n/format.ts`, `components/shared/DataGate.tsx`.

- [ ] `globals.css`:
  - Tailwind v4 `@import "tailwindcss"`, with shadcn variables replaced by the spec §4 tokens (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, `--success`, `--warning`, `--danger`, `--info`, `--bkash`, `--nagad`, `--rocket`, `--upay`, `--radius: 0.5rem`) for `:root` and `.dark`, and exposed through `@theme inline`.
  - Base: `html { font-size: 14px }`, and `.tabular { font-variant-numeric: tabular-nums }`.
  - Print CSS: `@media print` hides `[data-print-hide]`.
- [ ] `layout.tsx`:
  - Load Inter (`--font-sans`) and Hind_Siliguri (weights 400/500/600, subset bengali, `--font-bangla`) with `next/font/google`. The body font-family is `var(--font-sans), var(--font-bangla), system-ui`.
  - Set `<html lang={locale} suppressHydrationWarning>`.
  - Wrap children in `<Providers locale messages>`. `getLocale()` and `getMessages()` come from `next-intl/server`.
- [ ] `i18n/request.ts`:
  ```ts
  import { cookies } from "next/headers"; import { getRequestConfig } from "next-intl/server";
  export default getRequestConfig(async () => { const c = (await cookies()).get("NEXT_LOCALE")?.value; const locale = c === "bn" ? "bn" : "en"; return { locale, messages: (await import(`../messages/${locale}.json`)).default }; });
  ```
  In `next.config.ts`, wrap the config with `createNextIntlPlugin("./i18n/request.ts")`.
- [ ] `lib/i18n/locale.ts` (`"use server"`): `setLocale(l: "en"|"bn")` sets the cookie (1 year).
- [ ] `lib/i18n/format.ts`: `useFormat()` uses `useLocale()` and settings (currency precision and symbol placement from `useSettings()`, which falls back to precision 2 and "before"). It returns `money`, `number`, `date` (per the settings format), `dateTime`, `percent`, and `qty`. It uses `Intl.NumberFormat(locale==="bn"?"bn-BD":"en-US", …)` and prefixes `৳`.
- [ ] `messages/*.json`: the namespaces `common` (save, cancel, add, edit, delete, view, print, export, search, filters, all, actions, status, active, inactive, yes, no, total, loading, noData, comingSoon, …), `nav` (every group and item label plus users/roles/stockTransfers/stockAdjustments lists), `auth`, `header`, `products`, `dashboard`, `status` (paid/partial/due/overdue/final/draft/quotation/proforma/received/pending/ordered/in_transit/completed/packed/shipped/delivered/cancelled), and `errors`. Every key must exist in both files.
- [ ] `providers.tsx` (`"use client"`): `ThemeProvider attribute="class" defaultTheme="system"`, `NextIntlClientProvider`, `QueryClientProvider` (staleTime 30s), `TooltipProvider`, `<Toaster richColors position="top-right"/>`, `DataGate`.
- [ ] Run `npm run build`. Expected: success.
- [ ] Commit: `feat(ui): tokens, fonts, i18n and providers`.

### Task 9: Auth and permissions

**Files:** `lib/auth/permissions.ts`, `lib/auth/session.ts`, `lib/auth/useCan.ts`, `lib/auth/AuthGuard.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx`, `lib/auth/permissions.test.ts`

**Produces:**
```ts
export const PERMISSIONS: readonly string[];   // e.g. "dashboard.view","contacts.supplier","contacts.customer","customer_group.view","product.view","product.create","purchase.view","sell.view","pos.access","stock_transfer.view","stock_adjustment.view","expense.view","account.view","report.view","settings.business","settings.location","settings.invoice","settings.barcode","settings.printer","settings.tax","user.view","role.view","backup","modules"
export function hasPermission(role: { permissions: string[] } | null | undefined, p?: string): boolean; // "*" grants all; undefined p → true
export const useSession: UseBoundStore<…{ userId: string | null; login(u: string, p: string): boolean; logout(): void }>; // persist "posible:v1:session"
export function useCurrentUser(): { user: User; role: Role } | null;
export function useCan(): (p?: string) => boolean;
```
- [ ] Test: `hasPermission({permissions:["*"]},"x")` is true. `hasPermission({permissions:["a"]},"b")` is false. `hasPermission(null,undefined)` is true.
- [ ] Implement it.
  - The login page: a centred card with the logo mark, username and password fields (RHF + Zod), and a "Remember me" checkbox. It shows demo credentials as hint text, has the locale and theme toggles in the corner, shows an error when the credentials are wrong, and routes to `/home` on success.
  - `AuthGuard` waits for `hydrated`. If there's no user it redirects with `router.replace("/login")`, and it renders a skeleton meanwhile.
- [ ] Commit: `feat(auth): mock login, session and permissions`.

### Task 10: App shell

**Files:** `lib/nav.ts`, `components/layout/{AppShell,Sidebar,Header,Breadcrumbs,LocationSwitcher,LocaleToggle,ThemeToggle,Calculator,ProfitPopover,Notifications,UserMenu}.tsx`, `app/(app)/layout.tsx`

**Produces:**
```ts
export type NavItem = { key: string; href: string; icon?: LucideIcon; permission?: string; keywords?: string[] };
export type NavGroup = { key: string; icon: LucideIcon; href?: string; permission?: string; items?: NavItem[] };
export const NAV: NavGroup[];              // mirrors spec §3.3; labels via t(`nav.${key}`)
export function findNavTrail(pathname: string): { group?: NavGroup; item?: NavItem };
```
- [ ] Build `NAV` with these groups: home, contacts, products, purchases, sell, stock, expenses, accounts, reports, settings (which includes users, roles, backup, and modules), plus calendar.
- [ ] Sidebar:
  - The brand block ("pos_sible", with an indigo square logo mark), the `LocationSwitcher` (Select with "All locations" plus the locations; it sets `ui.locationId`), and a scrollable nav.
  - Each group is a `Collapsible`. The active item is highlighted with `bg-primary/10 text-primary` and a 2px left indicator.
  - The footer holds the "Open POS" button (primary, full width) and the collapse toggle.
  - Collapsed mode is a 64px icon rail with tooltips, and groups open a flyout `DropdownMenu`.
  - Below `lg` the sidebar renders inside a `Sheet` opened from a header button.
  - Items are hidden when `!can(item.permission)`.
- [ ] Header (sticky, 56px, `bg-background/80 backdrop-blur border-b`):
  - left: menu button (mobile) and `Breadcrumbs` (group › item)
  - centre: a search trigger button ("Search or jump to…  ⌘K")
  - right: `Calculator` (popover keypad with basic arithmetic), `ProfitPopover` (today's sales, cost, and profit from `dashboardService.kpis` for today), `Notifications` (a bell with a count, listing recent notifications), `LocaleToggle` (EN | বাং segmented, calls `setLocale` then `router.refresh()`), `ThemeToggle` (light/dark/system menu), and `UserMenu` (avatar, name, role, Profile, Sign out)
- [ ] `AppShell`: a grid `[sidebar][main]`. Main is `max-w-[1600px] mx-auto px-6 py-6`.
- [ ] `(app)/layout.tsx` renders `<AuthGuard><AppShell>{children}</AppShell></AuthGuard>`.
- [ ] Manual check with `npm run dev`: log in and see the shell, toggle BN (labels change), toggle dark, collapse the sidebar.
- [ ] Commit: `feat(shell): sidebar, header, toggles, popovers`.

### Task 11: Command palette

**Files:** `components/layout/CommandPalette.tsx`

- [ ] It's a `CommandDialog` opened by ⌘K / Ctrl+K and the header trigger. It has three groups:
  - "Pages": every NAV item the user can access, matched on the translated label and keywords
  - "Actions": New sale → `/pos`, Add product → `/products/new`, Add purchase, Add expense, Add contact → `/contacts/customers?new=1`
  - "Products" and "Contacts": live search through services, showing the top 5 each, once the query is 2 characters or longer

  Selecting a result navigates and closes the dialog.
- [ ] Commit: `feat(shell): command palette`.

### Task 12: Shared display components

**Files:** `components/shared/{PageHeader,StatCard,StatusBadge,Money,EmptyState,ComingSoon,ConfirmDialog,Forbidden}.tsx`

**Produces:**
```ts
PageHeader({ title, description?, actions?: ReactNode, children? })
StatCard({ label, value: ReactNode, icon?: LucideIcon, delta?: { value: number; positive?: boolean }, hint?: string, tone?: "default"|"success"|"warning"|"danger"|"info" })
StatusBadge({ status: string })   // maps status → tone + t(`status.${status}`)
Money({ value: number, className? })   // tabular, uses useFormat().money; negative in danger colour
EmptyState({ icon?, title, description?, action? })
ComingSoon({ title: string, module: string })   // placeholder page in shell: PageHeader + EmptyState "Coming in <module>"
ConfirmDialog({ open, onOpenChange, title, description?, confirmLabel?, destructive?, onConfirm })
Forbidden()
```
- [ ] Implement these components following the token rules. `StatusBadge` uses soft backgrounds (`bg-success/10 text-success`, …).
- [ ] Commit: `feat(ui): shared display components`.

### Task 13: DataTable, FilterBar, DateRangePicker

**Files:** `components/shared/DataTable/{DataTable,Toolbar,Pagination,ColumnMenu,BulkBar,RowActions,export}.tsx|ts`, `components/shared/FilterBar/{FilterBar,useUrlFilters}.tsx|ts`, `components/shared/DateRangePicker.tsx`, `lib/domain/dateRanges.ts` (+ test)

**Produces:**
```ts
type DataTableProps<T> = {
  tableId: string; columns: ColumnDef<T, any>[]; data: T[]; total: number; loading?: boolean;
  query: { page: number; pageSize: number; search: string; sort?: { id: string; desc: boolean } };
  onQueryChange: (q: Partial<DataTableProps<T>["query"]>) => void;
  selectable?: boolean; bulkActions?: (rows: T[]) => ReactNode; footer?: (rows: T[]) => ReactNode;
  toolbar?: ReactNode; exportName?: string; getRowId?: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode;
};
export function DataTable<T>(p: DataTableProps<T>): JSX.Element;
export function RowActions({ items }: { items: { label: string; icon?: LucideIcon; onClick?: () => void; href?: string; destructive?: boolean; hidden?: boolean }[] }): JSX.Element;
export function toCSV(rows: Record<string, unknown>[]): string; export function downloadCSV(name: string, csv: string): void;
type FilterDef = { key: string; label: string; type: "select"|"multiselect"|"daterange"|"toggle"; options?: { value: string; label: string }[] };
export function useUrlFilters<T extends Record<string, string|undefined>>(): [T, (patch: Partial<T>) => void, () => void];
export function FilterBar({ defs, value, onChange, onReset }): JSX.Element;
// dateRanges.ts
export type RangePreset = "today"|"yesterday"|"last7"|"last30"|"thisMonth"|"lastMonth"|"thisFY"|"lastFY";
export function presetRange(p: RangePreset, today: string, fyStartMonth: number): { from: string; to: string };
```
- [ ] Test `presetRange`:
  - `presetRange("thisMonth","2026-09-27",1)` → `{from:"2026-09-01",to:"2026-09-30"}`
  - `presetRange("thisFY","2026-09-27",7)` → `{from:"2026-07-01",to:"2027-06-30"}`
  - `presetRange("lastFY","2026-03-10",7)` → `{from:"2024-07-01",to:"2025-06-30"}`
  - `presetRange("last7","2026-09-27",1)` → `{from:"2026-09-21",to:"2026-09-27"}`

  Run → FAIL, implement → PASS.
- [ ] `DataTable`:
  - A card with a toolbar: a search input (debounced 250ms), the `toolbar` slot, a density toggle, the column-visibility menu, and an export menu (CSV and Print).
  - The table has a sticky header, sortable header buttons with arrows, a selection checkbox column, 40px rows (32px when compact), skeleton rows while loading, and the `EmptyState` when empty.
  - Footer: the `footer` slot for totals, then `Pagination` ("Showing x–y of N", page size select 10/25/50/100/All, and prev/next buttons).
  - `BulkBar` floats at the bottom when rows are selected.
  - Hidden columns and page size persist in `ui.tablePrefs[tableId]`.
  - It runs in manual mode (`manualPagination`, `manualSorting`) because the services paginate.
- [ ] `FilterBar`:
  - Renders chips horizontally: select/multiselect chips as a Popover with a Command list; daterange as `DateRangePicker` (presets plus a two-month calendar); toggles as a checkbox chip.
  - Active chips show their value and an × to clear it. There's a "Reset" link.
  - `useUrlFilters` reads and writes `useSearchParams` with `router.replace`.
- [ ] Commit: `feat(ui): DataTable, FilterBar, DateRangePicker`.

### Task 14: Route scaffold

**Files:**
- Every `page.tsx` listed in spec §3.3.
- `app/(app)/error.tsx`, `app/(app)/not-found.tsx`.
- `app/(pos)/layout.tsx`, `app/(pos)/pos/page.tsx`.
- `app/page.tsx`.
- `lib/routes.ts`, which maps each path to its sub-project name for the placeholders.

- [ ] Each unbuilt page is a client component that renders `<ComingSoon title={t("nav.<key>")} module="<Sub-project name>" />`. Dynamic routes read params through `use(params)` or `useParams()`.
- [ ] `app/page.tsx` is `redirect("/home")`. The `/home` placeholder page shows the 8 KPI `StatCard`s from `useDashboardKpis` for the current month, as the dashboard teaser. It uses the `LocationSwitcher` value.
- [ ] The `(pos)` layout is full-screen with `AuthGuard`. The page shows a slim top bar with a back link and a ComingSoon ("POS").
- [ ] `error.tsx`: a card with the message, a "Try again" button (`reset`), and a Home link. `not-found.tsx` uses EmptyState.
- [ ] Run `npm run build`. Expected: all routes compile.
- [ ] Commit: `feat(routes): scaffold every route with placeholders`.

### Task 15: Products list (reference screen)

**Files:** `features/products/ProductsList.tsx`, `features/products/columns.tsx`, `app/(app)/products/page.tsx`

- [ ] `PageHeader` with the title "Products" and the description "Manage your products". Actions: "Add product" (→ `/products/new`), plus Import and Export (menu).
- [ ] Tabs: "All products" and "Stock report". The stock tab reuses `DataTable` with the stock columns, computed via `productsService.list` rows.
- [ ] FilterBar: product type, category, unit, tax, brand, location, active state, and not-for-selling.
- [ ] Columns:
  - select checkbox, image (thumb or initials tile)
  - product (name, with the SKU in muted text below)
  - location names (badges)
  - purchase price and selling price (Money)
  - current stock (with an alert badge when below the alert qty)
  - type, category, brand, tax
  - row actions: View, Edit, Labels, Duplicate, Stock history, Deactivate/Activate, Delete (with confirm)
- [ ] Bulk actions: Delete selected, Add to location, Remove from location (a dialog with a location multiselect), and Deactivate selected.
- [ ] Manual check in the browser: filtering, sorting, pagination, bulk deactivate, BN toggle, and dark mode all work.
- [ ] Commit: `feat(products): reference products list`.

### Task 16: Verification

- [ ] Run `npm run test`. Expected: all pass.
- [ ] Run `npm run typecheck && npm run lint && npm run build`. Expected: clean.
- [ ] Browser smoke test through Playwright MCP: login admin/112233 → home KPIs → ⌘K "Products" → filter category → deactivate one → toggle BN → toggle dark → visit 5 random placeholder routes → logout. Take screenshots of the shell (light and dark, EN and BN).
- [ ] Commit any fixes: `chore: foundation verification fixes`.

---

## Self-review notes
- **Spec coverage:**
  - §3.1 → T7/T8/T9
  - §3.2 → T8
  - §3.3 → T14
  - §3.4 → file map
  - §4 → T8/T10/T12/T13
  - §5 → T5/T6/T7
  - §5.3 → T2–T4
  - §6 → T9
  - §7 → T7 errors and T14 error pages
  - §8 → tests in T2–T7/T13 and T16. The Playwright POS flow is deferred to the POS plan because POS is out of this plan's scope.
  - §9 → T16
- Some service writes (sales, purchases, returns, transfers, registers) are deliberately left to the owning sub-project plans. This plan provides `commit()`, the domain, and the errors they need.
