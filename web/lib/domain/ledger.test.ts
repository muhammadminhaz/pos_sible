import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { balanceSheet, buildJournal, cashFlow, expenseSign, trialBalance, type ReportFilter } from "./ledger";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const journal = buildJournal(seed);
const dates = [undefined, "2026-03-01", "2026-04-05", "2026-06-15", "2026-09-28", "2030-01-01"];
const locations = [null, LOC_RANGO, LOC_NIPUN];
const combos: ReportFilter[] = dates.flatMap((date) => locations.map((locationId) => ({ date, locationId })));
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.011);

describe("buildJournal", () => {
  it("makes only balanced entries", () => {
    expect(journal.length).toBeGreaterThan(500);
    for (const e of journal) {
      const d = e.lines.reduce((s, l) => s + l.debit, 0);
      const c = e.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(d - c) > 0.011) throw new Error(`unbalanced entry ${e.memo} ${e.date}: ${d} vs ${c}`);
    }
  });

  it("each entry's lines share one location, so any location's books balance on their own", () => {
    for (const e of journal) expect(new Set(e.lines.map((l) => l.locationId)).size).toBe(1);
  });
});

describe("trialBalance", () => {
  it("debits equal credits for any date and location", () => {
    for (const f of combos) {
      const tb = trialBalance(journal, f);
      near(tb.debit, tb.credit);
    }
  });

  it("is empty before anything happened", () => {
    expect(trialBalance(journal, { date: "2000-01-01" }).rows).toEqual([]);
  });
});

describe("balanceSheet", () => {
  it("balances (assets = liabilities + equity) on the seed for any date and location", () => {
    for (const f of combos) {
      const bs = balanceSheet(journal, f);
      near(bs.totalAssets, bs.totalLiabilities + bs.totalEquity);
    }
  });

  it("shows each account's balance as cash, and the stock still held as inventory", () => {
    const bs = balanceSheet(journal, {});
    for (const a of seed.accounts) {
      const held = seed.accountTxns.filter((x) => x.accountId === a.id).reduce((s, x) => s + (x.kind === "credit" ? x.amount : -x.amount), 0);
      near(bs.assets.find((r) => r.account === "cash" && r.accountId === a.id)?.amount ?? 0, held);
    }
    const lots = seed.stockLots.reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0);
    // Lot costs are rounded per lot and journal costs per line, so allow a few taka over ~৳10M of stock.
    expect(Math.abs(bs.assets.filter((r) => r.account === "inventory").reduce((s, r) => s + r.amount, 0) - lots)).toBeLessThan(5);
  });
});

describe("cashFlow", () => {
  const locationOf = (id: string) => seed.transactions.find((t) => t.id === id)?.locationId;
  it("closes at the account balance and carries the earlier balance forward", () => {
    const all = cashFlow(seed.accountTxns, locationOf, {});
    const held = seed.accountTxns.reduce((s, x) => s + (x.kind === "credit" ? x.amount : -x.amount), 0);
    near(all.closing, held);
    near(all.totalIn - all.totalOut, all.closing - all.opening);
    const part = cashFlow(seed.accountTxns, locationOf, { from: "2026-07-01", to: "2026-07-31" });
    near(part.opening + part.totalIn - part.totalOut, part.closing);
    expect(part.opening).not.toBe(0);
  });

  it("filters by account, direction and location", () => {
    const cash = cashFlow(seed.accountTxns, locationOf, { accountId: "acc_cash", kind: "debit" });
    expect(cash.rows.every((r) => r.accountId === "acc_cash" && r.kind === "debit")).toBe(true);
    expect(cash.totalIn).toBe(0);
    const loc = cashFlow(seed.accountTxns, locationOf, { locationId: LOC_NIPUN });
    expect(loc.rows.length).toBeGreaterThan(0);
    expect(loc.rows.every((r) => r.transactionId && locationOf(r.transactionId) === LOC_NIPUN)).toBe(true);
  });

  it("splits flows into operating, transfer and capital", () => {
    const all = cashFlow(seed.accountTxns, locationOf, {});
    expect(all.byCategory.operating.in).toBeGreaterThan(0);
    expect(all.byCategory.transfer.in).toBeCloseTo(all.byCategory.transfer.out, 2);
    expect(all.byCategory.capital.in).toBeGreaterThan(0);
  });
});

describe("expenseSign", () => {
  it("is negative for refunds", () => {
    expect(expenseSign({ isRefund: false })).toBe(1);
    expect(expenseSign({ isRefund: true })).toBe(-1);
  });
});
