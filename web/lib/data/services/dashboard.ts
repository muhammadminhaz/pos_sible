import { service } from "@/lib/data/api/facade";
import type { Transaction } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { expenseSign } from "@/lib/domain/ledger";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay } from "./_util";

export type KpiFilters = { locationId?: string | "all"; from?: string; to?: string };
export type Kpis = {
  totalSales: number;
  /** Sales − sell returns − expenses. */
  net: number;
  invoiceDue: number;
  sellReturn: number;
  totalPurchase: number;
  purchaseDue: number;
  purchaseReturn: number;
  expense: number;
};

const inRange = (t: Transaction, f: KpiFilters) => {
  const d = t.date.slice(0, 10);
  return (!f.from || d >= f.from) && (!f.to || d <= f.to) && (!f.locationId || f.locationId === "all" || t.locationId === f.locationId);
};

export const dashboardService = service("dashboardService", {
  async kpis(f: KpiFilters): Promise<Kpis> {
    await delay();
    const k = { totalSales: 0, invoiceDue: 0, sellReturn: 0, totalPurchase: 0, purchaseDue: 0, purchaseReturn: 0, expense: 0 };
    for (const t of getDB().transactions) {
      if (!inRange(t, f)) continue;
      const due = paymentSummary(t.totals.total, t.payments).due;
      if (t.type === "sell" && t.status === "final") {
        k.totalSales += t.totals.total;
        k.invoiceDue += due;
      } else if (t.type === "sell_return") k.sellReturn += t.totals.total;
      else if (t.type === "purchase" && t.status === "received") {
        k.totalPurchase += t.totals.total;
        k.purchaseDue += due;
      } else if (t.type === "purchase_return") k.purchaseReturn += t.totals.total;
      else if (t.type === "expense") k.expense += expenseSign(t) * t.totals.total;
    }
    const r = Object.fromEntries(Object.entries(k).map(([key, v]) => [key, roundMoney(v)])) as typeof k;
    return { ...r, net: roundMoney(r.totalSales - r.sellReturn - r.expense) };
  },
});

export type ProfitSummary = { sales: number; cost: number; expense: number; grossProfit: number; netProfit: number };

const lineCost = (l: Transaction["lines"][number]) =>
  l.allocations.length ? l.allocations.reduce((s, a) => s + a.qty * a.unitCost, 0) : l.qty * l.unitCost;

export const profitService = service("profitService", {
  /** Sales, cost of goods sold and profit for a period — powers the header "Today's profit" popover. */
  async summary(f: KpiFilters): Promise<ProfitSummary> {
    await delay();
    let sales = 0;
    let cost = 0;
    let expense = 0;
    for (const t of getDB().transactions) {
      if (!inRange(t, f)) continue;
      if (t.type === "sell" && t.status === "final") {
        sales += t.totals.total - t.totals.orderTax;
        cost += t.lines.reduce((s, l) => s + lineCost(l), 0);
      } else if (t.type === "sell_return") {
        sales -= t.totals.total - t.totals.orderTax;
        cost -= t.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
      } else if (t.type === "expense") expense += expenseSign(t) * t.totals.total;
    }
    const grossProfit = roundMoney(sales - cost);
    return {
      sales: roundMoney(sales),
      cost: roundMoney(cost),
      expense: roundMoney(expense),
      grossProfit,
      netProfit: roundMoney(grossProfit - expense),
    };
  },
});
