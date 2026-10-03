import type { AccountTxn, DB, Payment, Transaction, TxnLine } from "@/lib/data/schemas";
import { roundMoney } from "./money";

/** Expenses add to costs; a refund expense takes them back, so it counts negative everywhere. */
export const expenseSign = (t: Pick<Transaction, "isRefund">): 1 | -1 => (t.isRefund ? -1 : 1);

// ── Double-entry journal ────────────────────────────────────────────────
// The app stores documents and account entries, not a general ledger. The reports below derive a journal from them,
// one balanced entry per event, so a trial balance and balance sheet follow from the data instead of being plugged.

export type LedgerAccount =
  | "cash" | "receivable" | "inventory" | "interLocation" | "payable" | "expensePayable"
  | "capital" | "sales" | "salesReturns" | "cogs" | "expenses" | "purchaseCharges" | "adjustments";
export type LedgerData = Pick<DB, "transactions" | "accountTxns" | "accounts" | "stockLots">;
export type JournalLine = { account: LedgerAccount; /** Cash lines: the account; absent = payment with no account linked. */ accountId?: string; debit: number; credit: number; locationId: string | null };
export type JournalEntry = { date: string; memo: string; lines: JournalLine[] };

const dr = (account: LedgerAccount, amount: number, locationId: string | null, accountId?: string): JournalLine => ({ account, accountId, debit: roundMoney(amount), credit: 0, locationId });
const cr = (account: LedgerAccount, amount: number, locationId: string | null, accountId?: string): JournalLine => ({ account, accountId, debit: 0, credit: roundMoney(amount), locationId });

/** Which way a payment moves an account: `credit` = money in. Change handed back on a sale counts as money out. */
export function paymentKind(t: Pick<Transaction, "type" | "isRefund">, p: Pick<Payment, "isReturn">): "credit" | "debit" {
  switch (t.type) {
    case "sell": return p.isReturn ? "debit" : "credit";
    case "purchase_return": return "credit";
    case "expense": return t.isRefund ? "credit" : "debit";
    default: return "debit"; // purchase, sell_return
  }
}

/** What stock cost, from the lines' allocated unit cost. */
/** What the lots actually held: summed from the lot allocations when a sale has them, so the books and the stock report agree to the cent. */
const lineCost = (lines: TxnLine[]) =>
  roundMoney(lines.reduce((s, l) => s + (l.allocations?.length ? l.allocations.reduce((n, a) => n + a.qty * a.unitCost, 0) : l.qty * l.unitCost), 0));

/** Cash entry for one payment; `incoming` = money into our accounts. */
function paymentEntry(p: Payment, incoming: boolean, other: LedgerAccount, loc: string, memo: string): JournalEntry {
  const cash = incoming ? dr("cash", p.amount, loc, p.accountId ?? undefined) : cr("cash", p.amount, loc, p.accountId ?? undefined);
  const side = incoming ? cr(other, p.amount, loc) : dr(other, p.amount, loc);
  return { date: p.paidOn, memo, lines: [cash, side] };
}

export function buildJournal(data: LedgerData): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const t of data.transactions) {
    const loc = t.locationId;
    const total = t.totals.total;
    const memo = t.refNo;
    if (t.type === "sell" && t.status === "final") {
      out.push({ date: t.date, memo, lines: [dr("receivable", total, loc), cr("sales", total, loc)] });
      const cost = lineCost(t.lines);
      if (cost) out.push({ date: t.date, memo, lines: [dr("cogs", cost, loc), cr("inventory", cost, loc)] });
      for (const p of t.payments) out.push(paymentEntry(p, !p.isReturn, "receivable", loc, memo));
    } else if (t.type === "sell_return") {
      out.push({ date: t.date, memo, lines: [dr("salesReturns", total, loc), cr("receivable", total, loc)] });
      const cost = lineCost(t.lines);
      if (cost) out.push({ date: t.date, memo, lines: [dr("inventory", cost, loc), cr("cogs", cost, loc)] });
      for (const p of t.payments) out.push(paymentEntry(p, false, "receivable", loc, memo));
    } else if (t.type === "purchase") {
      if (t.status === "received") {
        // Stock is carried at line cost (what the lots hold); tax, shipping and extra charges net of the order discount are expensed.
        const stock = lineCost(t.lines);
        const extra = roundMoney(total - stock);
        out.push({ date: t.date, memo, lines: [dr("inventory", stock, loc), extra >= 0 ? dr("purchaseCharges", extra, loc) : cr("purchaseCharges", -extra, loc), cr("payable", total, loc)] });
      }
      for (const p of t.payments) out.push(paymentEntry(p, false, "payable", loc, memo));
    } else if (t.type === "purchase_return") {
      const stock = lineCost(t.lines);
      const extra = roundMoney(total - stock);
      out.push({ date: t.date, memo, lines: [dr("payable", total, loc), cr("inventory", stock, loc), extra >= 0 ? cr("purchaseCharges", extra, loc) : dr("purchaseCharges", -extra, loc)] });
      for (const p of t.payments) out.push(paymentEntry(p, true, "payable", loc, memo));
    } else if (t.type === "expense") {
      const k = expenseSign(t);
      out.push({ date: t.date, memo, lines: k > 0 ? [dr("expenses", total, loc), cr("expensePayable", total, loc)] : [dr("expensePayable", total, loc), cr("expenses", total, loc)] });
      for (const p of t.payments) out.push(paymentEntry(p, k < 0, "expensePayable", loc, memo));
    } else if (t.type === "stock_adjustment") {
      const cost = lineCost(t.lines);
      out.push({ date: t.date, memo, lines: [dr("adjustments", cost, loc), cr("inventory", cost, loc)] });
    } else if (t.type === "stock_transfer" && t.status === "completed" && t.transferLocationId) {
      const v = lineCost(t.lines);
      out.push({ date: t.date, memo, lines: [dr("interLocation", v, loc), cr("inventory", v, loc)] });
      out.push({ date: t.date, memo, lines: [dr("inventory", v, t.transferLocationId), cr("interLocation", v, t.transferLocationId)] });
    }
  }
  for (const lot of data.stockLots) {
    if (!lot.sourceTxnId) out.push({ date: lot.receivedAt, memo: lot.lotNo, lines: [dr("inventory", lot.qtyIn * lot.unitCost, lot.locationId), cr("capital", lot.qtyIn * lot.unitCost, lot.locationId)] });
  }
  // Entries with no document behind them: opening balances, deposits and transfers between accounts.
  const pairs = new Map<string, AccountTxn[]>();
  for (const a of data.accountTxns) {
    if (a.transactionId) continue;
    if (a.transferPairId) pairs.set(a.transferPairId, [...(pairs.get(a.transferPairId) ?? []), a]);
    else out.push({ date: a.date, memo: a.note, lines: [a.kind === "credit" ? dr("cash", a.amount, null, a.accountId) : cr("cash", a.amount, null, a.accountId), a.kind === "credit" ? cr("capital", a.amount, null) : dr("capital", a.amount, null)] });
  }
  for (const halves of pairs.values()) {
    out.push({ date: halves[0].date, memo: halves[0].note, lines: halves.map((a) => (a.kind === "credit" ? dr("cash", a.amount, null, a.accountId) : cr("cash", a.amount, null, a.accountId))) });
  }
  return out.filter((e) => e.lines.some((l) => l.debit || l.credit));
}

// ── Reports ─────────────────────────────────────────────────────────────

export type ReportFilter = { /** Inclusive, `yyyy-MM-dd`. */ date?: string; locationId?: string | null };

/** Net debit(+) / credit(−) per ledger account (cash split per bank/cash account), after the filter. */
function balances(journal: JournalEntry[], f: ReportFilter) {
  const net = new Map<string, { account: LedgerAccount; accountId?: string; net: number }>();
  for (const e of journal) {
    if (f.date && e.date.slice(0, 10) > f.date) continue;
    for (const l of e.lines) {
      if (f.locationId && l.locationId !== f.locationId) continue;
      const key = `${l.account}|${l.accountId ?? ""}`;
      const row = net.get(key) ?? { account: l.account, accountId: l.accountId, net: 0 };
      row.net = roundMoney(row.net + l.debit - l.credit);
      net.set(key, row);
    }
  }
  return [...net.values()].filter((r) => r.net !== 0);
}

export type TrialRow = { account: LedgerAccount; accountId?: string; debit: number; credit: number };
export function trialBalance(journal: JournalEntry[], f: ReportFilter = {}): { rows: TrialRow[]; debit: number; credit: number } {
  const rows = balances(journal, f).map((r): TrialRow => ({ account: r.account, accountId: r.accountId, debit: r.net > 0 ? r.net : 0, credit: r.net < 0 ? -r.net : 0 }));
  const sum = (k: "debit" | "credit") => roundMoney(rows.reduce((s, r) => s + r[k], 0));
  return { rows, debit: sum("debit"), credit: sum("credit") };
}

export type SheetRow = { account: LedgerAccount | "retained"; accountId?: string; amount: number };
export type BalanceSheet = { assets: SheetRow[]; liabilities: SheetRow[]; equity: SheetRow[]; totalAssets: number; totalLiabilities: number; totalEquity: number };

const PROFIT_AND_LOSS: LedgerAccount[] = ["sales", "salesReturns", "cogs", "expenses", "purchaseCharges", "adjustments"];

/** Assets = liabilities + equity, with profit to date shown as retained earnings. */
export function balanceSheet(journal: JournalEntry[], f: ReportFilter = {}): BalanceSheet {
  const rows = balances(journal, f);
  const assets: SheetRow[] = [];
  const liabilities: SheetRow[] = [];
  const equity: SheetRow[] = [];
  let profit = 0;
  for (const r of rows) {
    if (PROFIT_AND_LOSS.includes(r.account)) profit = roundMoney(profit - r.net);
    else if (r.account === "cash" || r.account === "receivable" || r.account === "inventory") assets.push({ account: r.account, accountId: r.accountId, amount: r.net });
    else if (r.account === "capital") equity.push({ account: r.account, amount: -r.net });
    else liabilities.push({ account: r.account, amount: -r.net });
  }
  if (profit !== 0) equity.push({ account: "retained", amount: profit });
  const sum = (xs: SheetRow[]) => roundMoney(xs.reduce((s, x) => s + x.amount, 0));
  return { assets, liabilities, equity, totalAssets: sum(assets), totalLiabilities: sum(liabilities), totalEquity: sum(equity) };
}

export type FlowCategory = "operating" | "transfer" | "capital";
export type FlowRow = { id: string; date: string; accountId: string; kind: "credit" | "debit"; category: FlowCategory; amount: number; transactionId: string | null; paymentId: string | null; note: string };
export type CashFlow = { rows: FlowRow[]; opening: number; totalIn: number; totalOut: number; closing: number; byCategory: Record<FlowCategory, { in: number; out: number }> };
export type CashFlowFilter = { from?: string; to?: string; locationId?: string | null; accountId?: string | null; kind?: "credit" | "debit" | null };

/** Account entries as a cash-flow statement. Opening is what the selected accounts held before `from`. */
export function cashFlow(accountTxns: AccountTxn[], locationOf: (transactionId: string) => string | undefined, f: CashFlowFilter = {}): CashFlow {
  const scoped = accountTxns
    .filter((a) => !f.accountId || a.accountId === f.accountId)
    // Entries with no document (opening balances, deposits, transfers) belong to no location.
    .filter((a) => !f.locationId || (a.transactionId && locationOf(a.transactionId) === f.locationId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const signed = (a: AccountTxn) => (a.kind === "credit" ? a.amount : -a.amount);
  const before = (a: AccountTxn) => !!f.from && a.date.slice(0, 10) < f.from;
  const opening = roundMoney(scoped.filter(before).reduce((s, a) => s + signed(a), 0));
  const inRange = scoped.filter((a) => !before(a) && (!f.to || a.date.slice(0, 10) <= f.to));
  const rows = inRange
    .filter((a) => !f.kind || a.kind === f.kind)
    .map((a): FlowRow => ({
      id: a.id, date: a.date, accountId: a.accountId, kind: a.kind, amount: a.amount, transactionId: a.transactionId, paymentId: a.paymentId, note: a.note,
      category: a.transactionId ? "operating" : a.subType === "fund_transfer" ? "transfer" : "capital",
    }));
  const byCategory: CashFlow["byCategory"] = { operating: { in: 0, out: 0 }, transfer: { in: 0, out: 0 }, capital: { in: 0, out: 0 } };
  for (const r of rows) byCategory[r.category][r.kind === "credit" ? "in" : "out"] = roundMoney(byCategory[r.category][r.kind === "credit" ? "in" : "out"] + r.amount);
  const totalIn = roundMoney(rows.filter((r) => r.kind === "credit").reduce((s, r) => s + r.amount, 0));
  const totalOut = roundMoney(rows.filter((r) => r.kind === "debit").reduce((s, r) => s + r.amount, 0));
  const closing = roundMoney(opening + inRange.reduce((s, a) => s + signed(a), 0));
  return { rows, opening, totalIn, totalOut, closing, byCategory };
}
