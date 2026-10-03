import { service } from "@/lib/data/api/facade";
import type { DB, PaymentMethod, Transaction } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { commission } from "@/lib/domain/commission";
import { expenseSign } from "@/lib/domain/ledger";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay } from "../_util";
import { registersService, type RegisterSummary } from "../registers";
import { dayOf, inScope, isFinalSale, names, sumBy, userLabel, withTotals, type ReportFilter, type ReportResult } from "./_shared";

// ── Purchase and sell payments ──────────────────────────────────────────

export type PaymentReportFilter = ReportFilter & { contactId?: string; method?: string; customerGroupId?: string };
export type PaymentLine = {
  id: string; date: string; paymentRef: string; refNo: string; contactName: string; locationName: string; method: string; accountName: string;
  /** Money in on sales is positive; change handed back is negative. */
  amount: number;
};

/** Payments by the date they were made. Sell change counts negative, so the total is what was actually kept. */
function paymentLines(d: DB, kind: "sell" | "purchase", f: PaymentReportFilter): ReportResult<PaymentLine> {
  const accounts = new Map(d.accounts.map((a) => [a.id, a.name]));
  const rows: PaymentLine[] = [];
  for (const t of d.transactions) {
    if (t.type !== kind || (f.locationId && t.locationId !== f.locationId) || (f.contactId && t.contactId !== f.contactId)) continue;
    if (kind === "sell" && t.status !== "final") continue;
    if (f.customerGroupId !== undefined && (d.contacts.find((c) => c.id === t.contactId)?.customerGroupId ?? "") !== f.customerGroupId) continue;
    for (const p of t.payments) {
      const day = dayOf(p.paidOn);
      if ((f.from && day < f.from) || (f.to && day > f.to) || (f.method && p.method !== f.method)) continue;
      rows.push({
        id: `${t.id}:${p.id}`, date: p.paidOn, paymentRef: p.refNo, refNo: t.refNo, contactName: names.contact(d, t.contactId), locationName: names.location(d, t.locationId),
        method: p.method, accountName: accounts.get(p.accountId ?? "") ?? "", amount: p.isReturn ? -p.amount : p.amount,
      });
    }
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return withTotals(rows, ["amount"]);
}

export const purchasePayments = (d: DB, f: PaymentReportFilter) => paymentLines(d, "purchase", f);
export const sellPayments = (d: DB, f: PaymentReportFilter) => paymentLines(d, "sell", f);

/** The same rows summed per payment method. */
export function byMethod(rows: PaymentLine[]): { method: PaymentMethod; count: number; amount: number }[] {
  const m = new Map<string, { count: number; amount: number }>();
  for (const r of rows) {
    const x = m.get(r.method) ?? { count: 0, amount: 0 };
    m.set(r.method, { count: x.count + 1, amount: roundMoney(x.amount + r.amount) });
  }
  return [...m.entries()].map(([method, v]) => ({ method: method as PaymentMethod, ...v })).sort((a, b) => b.amount - a.amount);
}

// ── Expense report ──────────────────────────────────────────────────────

export type ExpenseReportRow = { id: string; name: string; level: 0 | 1; count: number; total: number };
export type ExpenseReportFilter = ReportFilter & { categoryId?: string };

/** Per category with its sub-categories indented under it; refunds subtract. `totals.total` counts each expense once. */
export function expenseReport(d: DB, f: ExpenseReportFilter): ReportResult<ExpenseReportRow> {
  const ts = d.transactions.filter((t) => t.type === "expense" && inScope(t, f) && (!f.categoryId || t.expenseCategoryId === f.categoryId));
  const rows: ExpenseReportRow[] = [];
  for (const c of d.expenseCategories.filter((x) => !x.parentId)) {
    const mine = ts.filter((t) => t.expenseCategoryId === c.id);
    if (!mine.length) continue;
    rows.push({ id: c.id, name: c.name, level: 0, count: mine.length, total: sumBy(mine, (t) => expenseSign(t) * t.totals.total) });
    for (const s of d.expenseCategories.filter((x) => x.parentId === c.id)) {
      const sub = mine.filter((t) => t.expenseSubCategoryId === s.id);
      if (sub.length) rows.push({ id: s.id, name: s.name, level: 1, count: sub.length, total: sumBy(sub, (t) => expenseSign(t) * t.totals.total) });
    }
  }
  rows.sort((a, b) => (a.level === 0 && b.level === 0 ? b.total - a.total : 0));
  const top = rows.filter((r) => r.level === 0);
  return { rows, totals: { count: top.reduce((s, r) => s + r.count, 0), total: sumBy(top, (r) => r.total) } };
}

// ── Register sessions ───────────────────────────────────────────────────

export type RegisterReportFilter = ReportFilter & { userId?: string; status?: "open" | "close" };
export type RegisterReportRow = {
  id: string; userName: string; locationName: string; openedAt: string; closedAt: string | null; status: string;
  opening: number; byMethod: Partial<Record<PaymentMethod, number>>; totalSales: number; refunds: number; expenses: number; expectedCash: number; closingAmount: number | null; difference: number | null;
};

export async function registerReport(f: RegisterReportFilter): Promise<ReportResult<RegisterReportRow>> {
  const d = getDB();
  const regs = d.cashRegisters
    .filter((r) => (!f.locationId || r.locationId === f.locationId) && (!f.userId || r.userId === f.userId) && (!f.status || r.status === f.status))
    .filter((r) => (!f.from || dayOf(r.openedAt) >= f.from) && (!f.to || dayOf(r.openedAt) <= f.to))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const sums: RegisterSummary[] = await Promise.all(regs.map((r) => registersService.summary(r.id)));
  const rows = sums.map((s): RegisterReportRow => {
    const r = s.register;
    return {
      id: r.id, userName: userLabel(d.users, r.userId), locationName: names.location(d, r.locationId), openedAt: r.openedAt, closedAt: r.closedAt, status: r.status,
      opening: s.opening, byMethod: Object.fromEntries(s.byMethod.map((m) => [m.method, m.amount])), totalSales: s.totalSales, refunds: s.refunds, expenses: s.expenses,
      expectedCash: s.expectedCash, closingAmount: r.closingAmount, difference: r.closingAmount == null ? null : roundMoney(r.closingAmount - s.expectedCash),
    };
  });
  return withTotals(rows, ["opening", "totalSales", "refunds", "expenses", "expectedCash"]);
}

// ── Sales representatives ───────────────────────────────────────────────

export type RepRow = { userId: string; name: string; sales: number; sellReturn: number; netSales: number; commissionPercent: number; commission: number; expenses: number; invoices: number };
export type RepFilter = ReportFilter & { userId?: string };

/**
 * A representative is the commission agent on an invoice. Commission follows the business setting (invoice value or payments received)
 * and is taken on sales net of the returns against those invoices.
 */
export function salesReps(d: DB, f: RepFilter): ReportResult<RepRow> {
  const basis = d.settings.sale.commissionCalc;
  const ts = d.transactions.filter((t) => inScope(t, f));
  const agentOf = (t: Transaction) => (t.type === "sell_return" ? d.transactions.find((x) => x.id === t.parentId)?.commissionAgentId : t.commissionAgentId) ?? null;
  const rows = d.users
    .filter((u) => (f.userId ? u.id === f.userId : u.isSalesAgent || ts.some((t) => agentOf(t) === u.id)))
    .map((u): RepRow => {
      const sales = ts.filter((t) => isFinalSale(t) && t.commissionAgentId === u.id);
      const returns = ts.filter((t) => t.type === "sell_return" && agentOf(t) === u.id);
      const gross = sumBy(sales, (t) => t.totals.total);
      const back = sumBy(returns, (t) => t.totals.total);
      const paid = sumBy(sales, (t) => paymentSummary(t.totals.total, t.payments).paid);
      const earned = commission({ percent: u.commissionPercent, basis, invoiceTotal: gross, paid }) - commission({ percent: u.commissionPercent, basis: "invoice_value", invoiceTotal: back, paid: 0 });
      return {
        userId: u.id, name: userLabel(d.users, u.id), sales: gross, sellReturn: back, netSales: roundMoney(gross - back), commissionPercent: u.commissionPercent,
        commission: roundMoney(Math.max(0, earned)), invoices: sales.length, expenses: sumBy(ts.filter((t) => t.type === "expense" && t.expenseForUserId === u.id), (t) => expenseSign(t) * t.totals.total),
      };
    })
    .filter((r) => r.invoices || r.expenses || r.sellReturn || !(f.from || f.to))
    .sort((a, b) => b.netSales - a.netSales);
  return withTotals(rows, ["sales", "sellReturn", "netSales", "commission", "expenses", "invoices"]);
}

export type RepSaleRow = { id: string; date: string; refNo: string; customer: string; total: number; paid: number; commission: number };

/** Invoices a representative earned commission on, with the commission each carries. */
export function repSales(d: DB, userId: string, f: ReportFilter): ReportResult<RepSaleRow> {
  const u = d.users.find((x) => x.id === userId);
  const rows = d.transactions
    .filter((t) => isFinalSale(t) && inScope(t, f) && t.commissionAgentId === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t): RepSaleRow => {
      const paid = paymentSummary(t.totals.total, t.payments).paid;
      return { id: t.id, date: t.date, refNo: t.refNo, customer: names.contact(d, t.contactId), total: t.totals.total, paid, commission: commission({ percent: u?.commissionPercent ?? 0, basis: d.settings.sale.commissionCalc, invoiceTotal: t.totals.total, paid }) };
    });
  return withTotals(rows, ["total", "paid", "commission"]);
}

/** Sales created by this user (whatever their commission role). */
export function salesAddedBy(d: DB, userId: string, f: ReportFilter): ReportResult<RepSaleRow> {
  const rows = d.transactions
    .filter((t) => isFinalSale(t) && inScope(t, f) && t.createdBy === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t): RepSaleRow => ({ id: t.id, date: t.date, refNo: t.refNo, customer: names.contact(d, t.contactId), total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, commission: 0 }));
  return withTotals(rows, ["total", "paid"]);
}

export function repExpenses(d: DB, userId: string, f: ReportFilter): ReportResult<{ id: string; date: string; refNo: string; category: string; total: number; note: string }> {
  const cats = new Map(d.expenseCategories.map((c) => [c.id, c.name]));
  const rows = d.transactions
    .filter((t) => t.type === "expense" && inScope(t, f) && t.expenseForUserId === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({ id: t.id, date: t.date, refNo: t.refNo, category: cats.get(t.expenseCategoryId ?? "") ?? "", total: expenseSign(t) * t.totals.total, note: t.notes }));
  return withTotals(rows, ["total"]);
}

// ── Table report ────────────────────────────────────────────────────────

export type TableRow = { tableId: string; invoices: number; total: number };

export function tableReport(d: DB, f: ReportFilter): ReportResult<TableRow> {
  const by = new Map<string, Transaction[]>();
  for (const t of d.transactions) if (isFinalSale(t) && t.tableId && inScope(t, f)) by.set(t.tableId, [...(by.get(t.tableId) ?? []), t]);
  const rows = [...by.entries()].map(([tableId, ts]): TableRow => ({ tableId, invoices: ts.length, total: sumBy(ts, (t) => t.totals.total) })).sort((a, b) => b.total - a.total);
  return withTotals(rows, ["invoices", "total"]);
}

export const activityReports = service("activityReports", {
  async purchasePayments(f: PaymentReportFilter = {}) { await delay(); const r = purchasePayments(getDB(), f); return { ...r, byMethod: byMethod(r.rows) }; },
  async sellPayments(f: PaymentReportFilter = {}) { await delay(); const r = sellPayments(getDB(), f); return { ...r, byMethod: byMethod(r.rows) }; },
  async expense(f: ExpenseReportFilter = {}) { await delay(); return expenseReport(getDB(), f); },
  async registers(f: RegisterReportFilter = {}) { await delay(); return registerReport(f); },
  async reps(f: RepFilter = {}) { await delay(); return salesReps(getDB(), f); },
  async repSales(userId: string, f: ReportFilter = {}) { await delay(); return repSales(getDB(), userId, f); },
  async salesAdded(userId: string, f: ReportFilter = {}) { await delay(); return salesAddedBy(getDB(), userId, f); },
  async repExpenses(userId: string, f: ReportFilter = {}) { await delay(); return repExpenses(getDB(), userId, f); },
  async table(f: ReportFilter = {}) { await delay(); return tableReport(getDB(), f); },
});
