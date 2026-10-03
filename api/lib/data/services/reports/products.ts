import { service } from "@/lib/data/api/facade";
import type { DB, Transaction } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay } from "../_util";
import { inScope, isFinalSale, isReceivedPurchase, lineCostOf, lineTax, names, withTotals, type ReportFilter, type ReportResult } from "./_shared";

export type ProductFilter = ReportFilter & { categoryId?: string; brandId?: string; contactId?: string; search?: string };

function labeller(d: DB) {
  const prod = new Map(d.products.map((p) => [p.id, p]));
  const vars = new Map(d.variations.map((v) => [v.id, v]));
  return {
    prod, vars,
    label: (productId: string, variationId: string) => {
      const p = prod.get(productId), v = vars.get(variationId);
      return p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : productId;
    },
    sku: (variationId: string) => vars.get(variationId)?.sku ?? "",
  };
}

const passes = (d: DB, f: ProductFilter, productId: string, text: string) => {
  const p = d.products.find((x) => x.id === productId);
  return (!f.categoryId || p?.categoryId === f.categoryId) && (!f.brandId || p?.brandId === f.brandId) && (!f.search || text.toLowerCase().includes(f.search.toLowerCase()));
};

// ── Trending ────────────────────────────────────────────────────────────

export type TrendingRow = { variationId: string; label: string; sku: string; sold: number; revenue: number };

/** Top sellers by units, net of returns. */
export function trendingProducts(d: DB, f: ProductFilter, limit = 10): ReportResult<TrendingRow> {
  const L = labeller(d);
  const acc = new Map<string, TrendingRow>();
  for (const t of d.transactions) {
    if (!inScope(t, f) || !(isFinalSale(t) || t.type === "sell_return")) continue;
    const sign = t.type === "sell_return" ? -1 : 1;
    for (const l of t.lines) {
      if (!passes(d, f, l.productId, "")) continue;
      const r = acc.get(l.variationId) ?? { variationId: l.variationId, label: L.label(l.productId, l.variationId), sku: L.sku(l.variationId), sold: 0, revenue: 0 };
      r.sold = roundMoney(r.sold + sign * l.qty, 4);
      r.revenue = roundMoney(r.revenue + sign * l.subtotal);
      acc.set(l.variationId, r);
    }
  }
  const rows = [...acc.values()].filter((r) => r.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, limit);
  return withTotals(rows, ["sold", "revenue"]);
}

// ── Product purchase / product sell (line level) ────────────────────────

export type LineRow = {
  id: string; date: string; refNo: string; contactName: string; locationName: string; product: string; sku: string; lotNo: string;
  /** Returns carry a negative qty and amounts. */
  qty: number; unitPrice: number; tax: number; subtotal: number; cost: number; kind: string;
};

const lineRow = (d: DB, L: ReturnType<typeof labeller>, t: Transaction, l: Transaction["lines"][number], sign: 1 | -1, over?: { qty: number; lotNo: string; cost: number }): LineRow => {
  const qty = over?.qty ?? l.qty;
  const share = l.qty ? qty / l.qty : 0;
  return {
    id: `${t.id}:${l.id}${over ? `:${over.lotNo}` : ""}`, date: t.date, refNo: t.refNo, contactName: names.contact(d, t.contactId), locationName: names.location(d, t.locationId),
    product: L.label(l.productId, l.variationId), sku: L.sku(l.variationId), lotNo: over?.lotNo ?? l.lotNo, qty: sign * qty, unitPrice: l.unitPrice,
    tax: sign * roundMoney(lineTax(l) * share), subtotal: sign * roundMoney(l.subtotal * share), cost: sign * (over?.cost ?? lineCostOf(l)), kind: t.type,
  };
};

export function productPurchase(d: DB, f: ProductFilter): ReportResult<LineRow> {
  const L = labeller(d);
  const rows = d.transactions
    .filter((t) => inScope(t, f) && (isReceivedPurchase(t) || t.type === "purchase_return") && (!f.contactId || t.contactId === f.contactId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((t) => t.lines.filter((l) => passes(d, f, l.productId, `${L.label(l.productId, l.variationId)} ${L.sku(l.variationId)}`)).map((l) => lineRow(d, L, t, l, t.type === "purchase_return" ? -1 : 1)));
  return withTotals(rows, ["qty", "tax", "subtotal"]);
}

/** Sales lines; `byLot` splits each line across the lots it took stock from (with that lot's cost). */
export function productSellDetailed(d: DB, f: ProductFilter, byLot = false): ReportResult<LineRow> {
  const L = labeller(d);
  const lotNo = new Map(d.stockLots.map((l) => [l.id, l.lotNo]));
  const rows = d.transactions
    .filter((t) => inScope(t, f) && (isFinalSale(t) || t.type === "sell_return") && (!f.contactId || t.contactId === f.contactId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((t) => {
      const sign = t.type === "sell_return" ? -1 : 1;
      return t.lines
        .filter((l) => passes(d, f, l.productId, `${L.label(l.productId, l.variationId)} ${L.sku(l.variationId)}`))
        .flatMap((l) =>
          byLot && l.allocations.length
            ? l.allocations.map((a) => lineRow(d, L, t, l, sign, { qty: a.qty, lotNo: lotNo.get(a.lotId) || a.lotId, cost: roundMoney(a.qty * a.unitCost) }))
            : [lineRow(d, L, t, l, sign)],
        );
    });
  return withTotals(rows, ["qty", "tax", "subtotal", "cost"]);
}

export type GroupBy = "product" | "category" | "brand";
export type GroupedRow = { key: string; label: string; sku: string; qty: number; subtotal: number; cost: number; profit: number };

export function productSellGrouped(d: DB, by: GroupBy, f: ProductFilter): ReportResult<GroupedRow> {
  const L = labeller(d);
  const cats = new Map(d.categories.map((c) => [c.id, c.name]));
  const brands = new Map(d.brands.map((b) => [b.id, b.name]));
  const acc = new Map<string, GroupedRow>();
  for (const x of productSellDetailed(d, f).rows) {
    const t = d.transactions.find((y) => y.id === x.id.split(":")[0])!;
    const l = t.lines.find((y) => y.id === x.id.split(":")[1])!;
    const p = L.prod.get(l.productId);
    const [key, label, sku] =
      by === "product" ? [l.variationId, x.product, x.sku]
      : by === "category" ? [p?.categoryId ?? "", cats.get(p?.categoryId ?? "") ?? "", ""]
      : [p?.brandId ?? "", brands.get(p?.brandId ?? "") ?? "", ""];
    const r = acc.get(key) ?? { key, label, sku, qty: 0, subtotal: 0, cost: 0, profit: 0 };
    r.qty = roundMoney(r.qty + x.qty, 4);
    r.subtotal = roundMoney(r.subtotal + x.subtotal);
    r.cost = roundMoney(r.cost + x.cost);
    r.profit = roundMoney(r.subtotal - r.cost);
    acc.set(key, r);
  }
  return withTotals([...acc.values()].sort((a, b) => b.subtotal - a.subtotal), ["qty", "subtotal", "cost", "profit"]);
}

// ── Items: purchase → sale trace ────────────────────────────────────────

export type ItemRow = {
  id: string; product: string; sku: string; lotNo: string; purchaseRef: string; purchaseDate: string; supplier: string; purchaseCost: number;
  saleRef: string; saleDate: string; customer: string; qty: number; sellPrice: number; profit: number;
};
export type ItemFilter = ProductFilter & { supplierId?: string; customerId?: string };

/** One row per slice of a sale, tied back to the purchase (or opening stock) its lot came from. Returns are not traced. */
export function itemsReport(d: DB, f: ItemFilter): ReportResult<ItemRow> {
  const L = labeller(d);
  const lots = new Map(d.stockLots.map((l) => [l.id, l]));
  const byId = new Map(d.transactions.map((t) => [t.id, t]));
  const rows: ItemRow[] = [];
  for (const t of d.transactions) {
    if (!inScope(t, f) || !isFinalSale(t) || (f.customerId && t.contactId !== f.customerId)) continue;
    for (const l of t.lines) {
      if (!passes(d, f, l.productId, `${L.label(l.productId, l.variationId)} ${L.sku(l.variationId)}`)) continue;
      for (const a of l.allocations) {
        const lot = lots.get(a.lotId);
        const src = lot?.sourceTxnId ? byId.get(lot.sourceTxnId) : undefined;
        if (f.supplierId && src?.contactId !== f.supplierId) continue;
        const sellPrice = l.qty ? roundMoney((l.subtotal - lineTax(l)) / l.qty) : 0;
        rows.push({
          id: `${t.id}:${l.id}:${a.lotId}`, product: L.label(l.productId, l.variationId), sku: L.sku(l.variationId), lotNo: lot?.lotNo ?? "",
          purchaseRef: src?.refNo ?? "", purchaseDate: src?.date ?? lot?.receivedAt ?? "", supplier: names.contact(d, src?.contactId), purchaseCost: a.unitCost,
          saleRef: t.refNo, saleDate: t.date, customer: names.contact(d, t.contactId), qty: a.qty, sellPrice, profit: roundMoney(a.qty * (sellPrice - a.unitCost)),
        });
      }
    }
  }
  rows.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
  return withTotals(rows, ["qty", "profit"]);
}

export const productReports = service("productReports", {
  async trending(f: ProductFilter = {}, limit = 10) { await delay(); return trendingProducts(getDB(), f, limit); },
  async productPurchase(f: ProductFilter = {}) { await delay(); return productPurchase(getDB(), f); },
  async productSellDetailed(f: ProductFilter = {}, byLot = false) { await delay(); return productSellDetailed(getDB(), f, byLot); },
  async productSellGrouped(by: GroupBy, f: ProductFilter = {}) { await delay(); return productSellGrouped(getDB(), by, f); },
  async items(f: ItemFilter = {}) { await delay(); return itemsReport(getDB(), f); },
});
