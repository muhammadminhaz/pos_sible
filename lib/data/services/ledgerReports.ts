import { getDB } from "@/lib/data/store/db";
import { balanceSheet, buildJournal, cashFlow, trialBalance, type BalanceSheet, type CashFlow, type CashFlowFilter, type FlowRow, type ReportFilter, type TrialRow } from "@/lib/domain/ledger";
import { delay } from "./_util";

export type NamedRow<R> = R & { accountName: string };
export type TrialBalanceReport = { rows: NamedRow<TrialRow>[]; debit: number; credit: number };
export type BalanceSheetReport = BalanceSheet & { accountNames: Record<string, string> };
export type CashFlowRow = FlowRow & { accountName: string; refNo: string; locationName: string; description: string };
export type CashFlowReport = Omit<CashFlow, "rows"> & { rows: CashFlowRow[] };

const names = () => Object.fromEntries(getDB().accounts.map((a) => [a.id, a.name]));

/** Reports over the journal derived from the books; nothing here writes. */
export const ledgerReportsService = {
  async trialBalance(f: ReportFilter = {}): Promise<TrialBalanceReport> {
    await delay();
    const n = names();
    const tb = trialBalance(buildJournal(getDB()), f);
    return { ...tb, rows: tb.rows.map((r) => ({ ...r, accountName: r.accountId ? (n[r.accountId] ?? "") : "" })) };
  },

  async balanceSheet(f: ReportFilter = {}): Promise<BalanceSheetReport> {
    await delay();
    return { ...balanceSheet(buildJournal(getDB()), f), accountNames: names() };
  },

  async cashFlow(f: CashFlowFilter = {}): Promise<CashFlowReport> {
    await delay();
    const d = getDB();
    const n = names();
    const txn = (id: string | null) => (id ? d.transactions.find((t) => t.id === id) : undefined);
    const cf = cashFlow(d.accountTxns, (id) => txn(id)?.locationId, f);
    return {
      ...cf,
      rows: cf.rows.map((r) => {
        const t = txn(r.transactionId);
        return {
          ...r, accountName: n[r.accountId] ?? "", refNo: t?.payments.find((p) => p.id === r.paymentId)?.refNo ?? t?.refNo ?? "",
          locationName: d.locations.find((l) => l.id === t?.locationId)?.name ?? "", description: t?.type ?? "",
        };
      }),
    };
  },
};
