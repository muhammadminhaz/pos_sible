# pos_sible — Catalog Implementation Plan (sub-project 4) — DONE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax.

**Goal:** Replace every `/products/*` placeholder: product create/edit/detail, the reference lists (units, categories, brands, variations, warranties, price groups), opening stock, price update, imports and label printing.
**Architecture:** Extend `productsService` (create, update, duplicate, form load, opening stock, price rows). Reference lists reuse the generic `crud(table)` service and `useCrud` hook through one config-driven `CrudPage`. UI lives in `features/catalog/`. CSV work reuses `lib/csv.ts`; barcodes reuse `features/pos/receipt/Barcode.tsx`.
**Tech Stack:** as in the Sales plan.
**Branch:** `feat/catalog`, merged locally with `--no-ff`. Commits as the repo user, no trailer, no push.

## Global Constraints
- DB writes only through `commit()`; services start with `await delay()`, call `assertCan(...)`, throw `AppError` subclasses; UI never imports `getDB`.
- Query keys start with the table name. Messages only via `node scripts/messages.mjs messages` as `[en, bn]` pairs; never hand-edit `messages/*.json`.
- Money/qty through `useFormat`/`roundMoney`; prices use `lib/domain/pricing.ts`; units use `lib/domain/units.ts`.
- React Compiler rules: no setState in effects, no variable mutation during render. Title Case labels.
- Before each commit: `npx vitest run`, `npx tsc --noEmit`, `npm run lint` clean.

## Review Focus
- SKU uniqueness across products and variations; auto SKU never collides after deletes.
- Deleting a unit, category, brand or tax that products use is rejected with a clear message.
- A variable product needs ≥1 variation; a combo cannot contain itself.
- Changing `manageStock` off on a product that has stock lots keeps the lots (history) but stops selling from them.
- Margin and selling-price edits stay consistent (exc/inc tax both ways) and round to 2 dp.
- Opening stock added twice for the same location adds a second lot, never overwrites.
- Import with one bad row reports the row number and imports nothing.
- Label quantity 0 or negative is rejected; empty selection disables Preview.

## Tasks
### Task 1: Generic CRUD page kit + Brands, Warranties, Price groups
**Files:** Create `features/catalog/CrudPage.tsx`, `features/catalog/configs.tsx`; modify pages `products/brands`, `products/warranties`, `products/price-groups`.
**Interfaces — Produces:** `CrudPage<T>({ table, title, columns, fields, permission })` where `fields` is a small typed descriptor list (text, textarea, number, select, switch) rendered in a dialog.
- [x] Test: `crud` refuses delete when referenced (add `inUse` guard hook per table in `catalog.ts`; unit test each guard).
- [x] Build list + add/edit/delete dialog; browser-check EN/BN.
### Task 2: Units and Categories
**Files:** `features/catalog/{UnitsPage,CategoriesPage}.tsx`; pages `units`, `categories`.
- Units: name, short name, allow decimal, optional base unit + multiplier (1 bag = 50 KG). Categories: name, code, description, parent (one level of sub-category).
- [x] Tests: multiplier requires a base unit; a category can't be its own parent; deleting a parent with children is rejected.
### Task 3: Variation templates
**Files:** `features/catalog/VariationsPage.tsx`; page `variations`. Template name + editable list of values (add/remove/reorder). Test: duplicate value names rejected.
### Task 4: productsService — create, update, duplicate, form load
**Interfaces — Produces:**
```ts
productsService.getForm(id): Promise<ProductFormData>          // product + variations + price-group prices + combo items
productsService.create(input: ProductFormData): Promise<{ id: string }>
productsService.update(id, input: ProductFormData): Promise<void>
productsService.nextSku(prefix?: string): Promise<string>
```
Variations for `variable` products come from template values (Size × Color cartesian product) with per-variation SKU/price/image. Combo stores `comboItems`.
- [x] Tests (write first): auto SKU when blank with the settings prefix; duplicate SKU rejected; variable product builds the cartesian variations; combo self-reference rejected; update keeps ids of unchanged variations; price-group prices saved per variation; needs `product.create` / `product.update`.
### Task 5: Product form UI
**Files:** `features/catalog/ProductForm.tsx` (+ small section components); pages `products/new`, `products/[id]/edit`.
Sections: Basic (name, SKU, barcode type, unit + sub-units, brand, category/sub-category, locations, manage stock + alert qty, description, image, brochure name), Advanced (expiry period, serial/IMEI, not for selling, weight, preparation time, rack/row/position, warranty, custom fields), Pricing (tax, tax type, product type single/variable/combo with purchase exc/inc, margin %, selling exc/inc, variations table, combo builder). Save, Save and add another, Save and add opening stock, Save and add price-group prices. `?duplicate=` prefills.
- [x] Browser-check: create single, variable and combo; edit; duplicate.
### Task 6: Product detail
**Files:** `features/catalog/ProductDetail.tsx`; page `products/[id]`. Info card, variations table, stock by location, price groups, stock history (lots and sale/purchase/return lines). Needs `productsService.history(id)` + test that it lists every lot and line in date order.
### Task 7: Opening stock
**Interfaces:** `productsService.addOpeningStock(productId, rows: { variationId; locationId; qty; unitCost; lotNo?; mfgDate?; expDate? }[])`.
- [x] Tests: creates lots with `sourceTxnId: null`; product must manage stock; qty ≤ 0 rejected; shows up in `available()`.
- [x] UI dialog from the product form, list row action and detail page.
### Task 8: Update price (export / import)
**Files:** `features/catalog/UpdatePrice.tsx`; `lib/data/services/priceSheet.ts` (+ test). Export CSV columns: sku, name, purchase_exc, sell_exc, sell_inc, then one column per price group. Import validates SKUs and numbers, shows a review table, applies in one commit.
### Task 9: Import products and import opening stock
**Files:** `lib/data/services/productImport.ts` (+ test), `features/catalog/ImportProducts.tsx` (shared upload/review/commit shell `ImportWizard`, reused by Contacts later). Template download, row-level errors, `importBatch` record.
### Task 10: Print labels
**Files:** `features/catalog/Labels.tsx`, `features/catalog/LabelSheet.tsx`, `lib/domain/labels.ts` (+ test).
Product search, rows (qty, packing date, expiry, price group), per-field toggles with font size (name, variation, price inc/exc, business, packing date, expiry), sheet preset from barcode settings (20/30/32/40/50 per Letter sheet, continuous roll, custom), Preview, Print via the `[data-print-root]` portal.
- [x] Test `lib/domain/labels.ts`: rows-per-page math, label count expansion, page breaks.
### Task 11: Wire-up, smoke, final review
- [x] Products list row actions (Labels, Opening stock, Duplicate) work. Playwright smoke: create product → opening stock → sell in POS → label preview. Full checks, whole-branch review, merge, delete branch.
