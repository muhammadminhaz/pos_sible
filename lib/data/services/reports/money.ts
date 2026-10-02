import { format, parseISO, subDays } from "date-fns";
import type { DB, Transaction } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { balanceSheet, buildJournal, expenseSign } from "@/lib/domain/ledger";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay } from "../_util";
import { dayOf, inScope, isFinalSale, isReceivedPurchase, lineCostOf, lineTax, names, sumBy, withTotals, type ReportFilter, type ReportResult } from "./_shared";

// ── Profit / loss ───────────────────────────────────────────────────────

export type ProfitLoss = {
  openingStock: number; closingStock: number;
  sales: number; sellReturn: number; cogs: number; grossProfit: number;
  expenses: number; netProfit: number;
  totalPurchase: number; purchaseReturn: number; stockAdjustment: number;
};
export type ProfitDimension = "product" | "category" | "brand" | "location" | "invoice" | "date" | "customer";
export type ProfitRow = { key: string; label: string; sales: number; cost: number; profit: number; margin: number };

const exTax = (t: Transaction) => t.totals.total - t.totals.orderTax;
const cogsOf = (t: Transaction) => sumBy(t.lines, lineCostOf);

function stockValue(d: DB, date: string | undefined, locationId: string | null | undefined) {
  const bs = balanceSheet(buildJournal(d), { date, locationId });
  return sumBy(bs.assets.filter((r) => r.account === "inventory"), (r) => r.amount);
}

export function profitLoss(d: DB, f: ReportFilter): ProfitLoss {
  let sales = 0, sellReturn = 0, cogs = 0, expenses = 0, totalPurchase = 0, purchaseReturn = 0, stockAdjustment = 0;
  for (const t of d.transactions) {
    if (!inScope(t, f)) continue;
    if (isFinalSale(t)) { sales += exTax(t); cogs += cogsOf(t); }
    else if (t.type === "sell_return") { sellReturn += exTax(t); cogs -= sumBy(t.lines, (l) => l.qty * l.unitCost); }
    else if (t.type === "expense") expenses += expenseSign(t) * t.totals.total;
    else if (isReceivedPurchase(t)) totalPurchase += t.totals.total;
    else if (t.type === "purchase_return") purchaseReturn += t.totals.total;
    else if (t.type === "stock_adjustment") stockAdjustment += sumBy(t.lines, lineCostOf);
  }
  const grossProfit = roundMoney(sales - sellReturn - cogs);
  return {
    // Stock at the end of the day before `from`, and at the end of `to`, straight from the ledger journal.
    openingStock: f.from ? stockValue(d, format(subDays(parseISO(f.from), 1), "yyyy-MM-dd"), f.locationId) : 0,
    closingStock: stockValue(d, f.to, f.locationId),
    sales: roundMoney(sales), sellReturn: roundMoney(sellReturn), cogs: roundMoney(cogs), grossProfit,
    expenses: roundMoney(expenses), netProfit: roundMoney(grossProfit - expenses),
    totalPurchase: roundMoney(totalPurchase), purchaseReturn: roundMoney(purchaseReturn), stockAdjustment: roundMoney(stockAdjustment),
  };
}

/**
 * Profit grouped by one dimension; returns count negative. Each document's order-level discount, shipping and extra charges
 * are spread over its lines in proportion to their value, so every grouping adds up to the summary's gross profit.
 */
export function profitBreakdown(d: DB, dim: ProfitDimension, f: ReportFilter): ReportResult<ProfitRow> {
  const prod = new Map(d.products.map((p) => [p.id, p]));
  const cats = new Map(d.categories.map((c) => [c.id, c.name]));
  const brands = new Map(d.brands.map((b) => [b.id, b.name]));
  const vars = new Map(d.variations.map((v) => [v.id, v]));
  const acc = new Map<string, { label: string; sales: number; cost: number }>();
  for (const t of d.transactions) {
    if (!inScope(t, f) || !(isFinalSale(t) || t.type === "sell_return")) continue;
    const sign = t.type === "sell_return" ? -1 : 1;
    const lineEx = sumBy(t.lines, (l) => l.subtotal - lineTax(l));
    const adjust = lineEx > 0 ? (exTax(t) - lineEx) / lineEx : 0;
    for (const l of t.lines) {
      const p = prod.get(l.productId);
      const v = vars.get(l.variationId);
      const [key, label] =
        dim === "product" ? [l.variationId, p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId]
        : dim === "category" ? [p?.categoryId ?? "", cats.get(p?.categoryId ?? "") ?? ""]
        : dim === "brand" ? [p?.brandId ?? "", brands.get(p?.brandId ?? "") ?? ""]
        : dim === "location" ? [t.locationId, names.location(d, t.locationId)]
        : dim === "invoice" ? [t.id, t.refNo]
        : dim === "date" ? [dayOf(t.date), dayOf(t.date)]
        : [t.contactId ?? "", names.contact(d, t.contactId)];
      const row = acc.get(key) ?? { label, sales: 0, cost: 0 };
      row.sales += sign * (l.subtotal - lineTax(l)) * (1 + adjust);
      row.cost += sign * (t.type === "sell_return" ? l.qty * l.unitCost : lineCostOf(l));
      acc.set(key, row);
    }
  }
  const rows = [...acc.entries()]
    .map(([key, r]): ProfitRow => {
      const sales = roundMoney(r.sales), cost = roundMoney(r.cost), profit = roundMoney(sales - cost);
      return { key, label: r.label, sales, cost, profit, margin: sales ? roundMoney((profit / sales) * 100) : 0 };
    })
    .sort((a, b) => (dim === "date" ? b.label.localeCompare(a.label) : b.profit - a.profit));
  return withTotals(rows, ["sales", "cost", "profit"]);
}

// ── Purchase & sale ─────────────────────────────────────────────────────

export type Flow = { count: number; total: number; tax: number; due: number };
export type PurchaseSale = { purchases: Flow; purchaseReturns: Flow; sales: Flow; sellReturns: Flow; saleMinusPurchase: number; dueDifference: number };

const taxOf = (t: Transaction) => roundMoney(t.totals.orderTax + sumBy(t.lines, lineTax));
function flow(ts: Transaction[]): Flow {
  return { count: ts.length, total: sumBy(ts, (t) => t.totals.total), tax: sumBy(ts, taxOf), due: sumBy(ts, (t) => paymentSummary(t.totals.total, t.payments).due) };
}

export function purchaseSale(d: DB, f: ReportFilter): PurchaseSale {
  const ts = d.transactions.filter((t) => inScope(t, f));
  const purchases = flow(ts.filter(isReceivedPurchase));
  const purchaseReturns = flow(ts.filter((t) => t.type === "purchase_return"));
  const sales = flow(ts.filter(isFinalSale));
  const sellReturns = flow(ts.filter((t) => t.type === "sell_return"));
  return {
    purchases, purchaseReturns, sales, sellReturns,
    saleMinusPurchase: roundMoney(sales.total - sellReturns.total - (purchases.total - purchaseReturns.total)),
    dueDifference: roundMoney(sales.due - purchases.due),
  };
}

// ── Tax ─────────────────────────────────────────────────────────────────

export type TaxKind = "input" | "output" | "expense";
export type TaxRow = { id: string; date: string; refNo: string; contactName: string; locationName: string; kind: string; total: number; tax: number };

/** Tax collected (output), paid on purchases (input) or on expenses. Returns come through negative. */
export function taxRows(d: DB, kind: TaxKind, f: ReportFilter): ReportResult<TaxRow> {
  const pick = (t: Transaction): 1 | -1 | 0 =>
    kind === "output" ? (isFinalSale(t) ? 1 : t.type === "sell_return" ? -1 : 0)
    : kind === "input" ? (isReceivedPurchase(t) ? 1 : t.type === "purchase_return" ? -1 : 0)
    : t.type === "expense" ? expenseSign(t) : 0;
  const rows = d.transactions
    .filter((t) => inScope(t, f) && pick(t) !== 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t): TaxRow => {
      const k = pick(t);
      return { id: t.id, date: t.date, refNo: t.refNo, contactName: names.contact(d, t.contactId), locationName: names.location(d, t.locationId), kind: t.type, total: k * t.totals.total, tax: k * taxOf(t) };
    });
  return withTotals(rows, ["total", "tax"]);
}

export type TaxSummary = { output: number; input: number; expense: number; payable: number };
export function taxSummary(d: DB, f: ReportFilter): TaxSummary {
  const output = taxRows(d, "output", f).totals.tax ?? 0;
  const input = taxRows(d, "input", f).totals.tax ?? 0;
  const expense = taxRows(d, "expense", f).totals.tax ?? 0;
  return { output, input, expense, payable: roundMoney(output - input - expense) };
}

export const moneyReports = {
  async profitLoss(f: ReportFilter = {}) { await delay(); return profitLoss(getDB(), f); },
  async profitBreakdown(dim: ProfitDimension, f: ReportFilter = {}) { await delay(); return profitBreakdown(getDB(), dim, f); },
  async purchaseSale(f: ReportFilter = {}) { await delay(); return purchaseSale(getDB(), f); },
  async tax(kind: TaxKind, f: ReportFilter = {}) { await delay(); return { ...taxRows(getDB(), kind, f), summary: taxSummary(getDB(), f) }; },
};
