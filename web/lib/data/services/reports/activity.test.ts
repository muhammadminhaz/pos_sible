import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { expensesService } from "../expenses";
import { purchasesService } from "../purchases";
import { registersService } from "../registers";
import { accountsService } from "../accounts";
import { byMethod, expenseReport, purchasePayments, registerReport, repExpenses, repSales, salesAddedBy, salesReps, sellPayments, tableReport } from "./activity";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const f = { from: "2026-04-01", to: "2026-09-30" };
const near = (a: number, b: number, eps = 0.011) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("payment reports", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("purchase payments reconcile with the purchases list's paid total", async () => {
    const r = purchasePayments(getDB(), {});
    const list = await purchasesService.list({ pageSize: -1 });
    near(r.totals.amount!, list.totals.paid);
    const loc = purchasePayments(getDB(), { locationId: LOC_RANGO });
    const locList = await purchasesService.list({ locationId: LOC_RANGO, pageSize: -1 });
    near(loc.totals.amount!, locList.totals.paid);
  });

  it("sell payments equal what sales put into the accounts (change nets out) and method groups add up", async () => {
    const r = sellPayments(getDB(), {});
    const ledger = getDB().accountTxns.filter((a) => a.transactionId && getDB().transactions.find((t) => t.id === a.transactionId)?.type === "sell").reduce((s, a) => s + (a.kind === "credit" ? a.amount : -a.amount), 0);
    near(r.totals.amount!, ledger, 0.5);
    near(byMethod(r.rows).reduce((s, m) => s + m.amount, 0), r.totals.amount!);
    const cash = sellPayments(getDB(), { method: "cash" });
    expect(cash.rows.every((x) => x.method === "cash")).toBe(true);
    expect(cash.totals.amount!).toBeLessThan(r.totals.amount!);
    // Only the payments inside the dates are counted, and both end days are included.
    const day = r.rows[0].date.slice(0, 10);
    expect(sellPayments(getDB(), { from: day, to: day }).rows.length).toBeGreaterThan(0);
    expect(sellPayments(getDB(), { from: "2000-01-01", to: "2000-01-02" }).rows).toEqual([]);
    expect((await accountsService.paymentReport({ pageSize: -1 })).total).toBeGreaterThan(0);
  });

  it("filters sell payments by customer group", () => {
    const g = seed.customerGroups[0].id;
    const r = sellPayments(seed, { customerGroupId: g });
    expect(r.rows.length).toBeLessThan(sellPayments(seed, {}).rows.length);
  });
});

describe("expense report", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("reconciles with the expenses list, nets refunds and counts each expense once", async () => {
    for (const r of [{}, f, { ...f, locationId: LOC_RANGO }] as { from?: string; to?: string; locationId?: string }[]) {
      const rep = expenseReport(getDB(), r);
      const list = await expensesService.list({ from: r.from, to: r.to, locationId: r.locationId, pageSize: -1 });
      near(rep.totals.total!, list.totals.total);
      expect(rep.totals.count).toBe(list.total);
    }
    await expensesService.save({ locationId: LOC_RANGO, categoryId: "exp_rent", date: "2026-09-20T10:00:00", note: "", isRefund: true, amount: 500 });
    const list = await expensesService.list({ pageSize: -1 });
    near(expenseReport(getDB(), {}).totals.total!, list.totals.total);
  });

  it("sub-categories add up to their parent's expenses", () => {
    const rep = expenseReport(seed, {});
    const util = rep.rows.find((r) => r.id === "exp_utility")!;
    const subs = rep.rows.filter((r) => r.level === 1);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.reduce((s, r) => s + r.total, 0)).toBeLessThanOrEqual(util.total + 0.01);
  });
});

describe("register report", () => {
  it("each row's figures are the register summary's, so the report still reconciles", async () => {
    resetDB(structuredClone(seed));
    const rep = await registerReport({});
    expect(rep.rows.length).toBe(getDB().cashRegisters.length);
    for (const row of rep.rows.slice(0, 10)) {
      const s = await registersService.summary(row.id);
      near(row.expectedCash, s.expectedCash);
      near(Object.values(row.byMethod).reduce((a, b) => a + (b ?? 0), 0), s.byMethod.reduce((a, m) => a + m.amount, 0));
    }
    const open = await registerReport({ status: "open" });
    expect(open.rows.every((r) => r.status === "open" && r.difference === null)).toBe(true);
  });
});

describe("sales representatives", () => {
  const agent = () => seed.users.find((u) => u.isSalesAgent && seed.transactions.some((t) => t.commissionAgentId === u.id))!;
  it("net sales subtract returns and commission follows the percent", () => {
    const a = agent();
    const r = salesReps(seed, { ...f, userId: a.id }).rows[0];
    near(r.netSales, r.sales - r.sellReturn);
    expect(r.commission).toBeGreaterThanOrEqual(0);
    if (seed.settings.sale.commissionCalc === "invoice_value") near(r.commission, Math.max(0, ((r.sales - r.sellReturn) * a.commissionPercent) / 100), 0.05);
  });
  it("per-invoice commission adds up to the gross commission, and sales added only lists the user's own", () => {
    const a = agent();
    const per = repSales(seed, a.id, f);
    const row = salesReps(seed, { ...f, userId: a.id }).rows[0];
    expect(per.rows.length).toBe(row.invoices);
    near(per.totals.total!, row.sales);
    expect(per.totals.commission!).toBeGreaterThanOrEqual(row.commission - 0.05);
    expect(salesAddedBy(seed, "user_cashier", f).rows.every((x) => seed.transactions.find((t) => t.id === x.id)!.createdBy === "user_cashier")).toBe(true);
  });
  it("expenses logged for a user are listed and refunds subtract", () => {
    const e = seed.transactions.find((t) => t.type === "expense" && t.expenseForUserId)!;
    const r = repExpenses(seed, e.expenseForUserId!, {});
    expect(r.rows.length).toBeGreaterThan(0);
    near(salesReps(seed, { userId: e.expenseForUserId! }).rows[0].expenses, r.totals.total!);
  });
});

describe("table report", () => {
  it("groups tabled sales and is empty when no sale has a table", () => {
    expect(tableReport(seed, f).rows).toEqual([]);
    const d = structuredClone(seed);
    const s = d.transactions.filter((t) => t.type === "sell" && t.status === "final").slice(0, 2);
    s[0].tableId = "t1"; s[1].tableId = "t1";
    const r = tableReport(d, {});
    expect(r.rows).toEqual([{ tableId: "t1", invoices: 2, total: s[0].totals.total + s[1].totals.total }]);
  });
});
