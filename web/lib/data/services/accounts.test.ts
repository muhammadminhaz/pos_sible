import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { ACC } from "@/lib/data/seed/org";
import { getDB, resetDB } from "@/lib/data/store/db";
import { accountsService } from "./accounts";
import { crud } from "./catalog";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const base = { name: "Petty Cash", typeId: "at_cash", number: "", note: "", details: [], openingBalance: 0, allowOverdraft: false };
const code = async (p: Promise<unknown>) => p.then(() => null, (e: AppError) => e.code);
const field = async (p: Promise<unknown>) => p.then(() => null, (e: ValidationError) => e.fields);
const balanceOf = async (id: string) => (await accountsService.list({})).find((a) => a.id === id)!.balance;

describe("accountsService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("balance = opening + credits − debits, for every seeded account", async () => {
    for (const a of await accountsService.list({})) {
      const rows = getDB().accountTxns.filter((x) => x.accountId === a.id);
      const credits = rows.filter((x) => x.kind === "credit" && x.subType !== "opening_balance").reduce((s, x) => s + x.amount, 0);
      const debits = rows.filter((x) => x.kind === "debit").reduce((s, x) => s + x.amount, 0);
      const opening = getDB().accounts.find((x) => x.id === a.id)!.openingBalance;
      expect(a.balance).toBeCloseTo(opening + credits - debits, 2);
    }
  });

  it("creating with an opening balance posts it once; editing it adjusts the same entry", async () => {
    const { id } = await accountsService.save({ ...base, openingBalance: 500 });
    expect(await balanceOf(id)).toBe(500);
    await accountsService.save({ ...base, id, openingBalance: 800 });
    expect(await balanceOf(id)).toBe(800);
    expect(getDB().accountTxns.filter((x) => x.accountId === id && x.subType === "opening_balance")).toHaveLength(1);
    await accountsService.save({ ...base, id, openingBalance: 0 });
    expect(await balanceOf(id)).toBe(0);
  });

  it("lists by status with type and sub-type names", async () => {
    const { id } = await accountsService.save({ ...base, name: "Mobile", typeId: "at_mfs" });
    const row = (await accountsService.list({})).find((a) => a.id === id)!;
    expect(row).toMatchObject({ typeName: "Current Assets", subTypeName: "Mobile Banking", status: "active" });
    expect((await accountsService.list({ status: "closed" }))).toHaveLength(0);
    await accountsService.close(id);
    expect((await accountsService.list({ status: "closed" })).map((a) => a.id)).toEqual([id]);
    expect((await accountsService.list({ status: "active" })).some((a) => a.id === id)).toBe(false);
  });

  it("a transfer writes a debit and a credit sharing transferPairId", async () => {
    const [cash, bank] = [await balanceOf(ACC.cash), await balanceOf(ACC.bank)];
    await accountsService.transfer({ from: ACC.cash, to: ACC.bank, amount: 1000, note: "Bank run", date: "2026-09-28T10:00:00" });
    const pair = getDB().accountTxns.filter((x) => x.subType === "fund_transfer" && x.note === "Bank run");
    expect(pair).toHaveLength(2);
    expect(pair[0].transferPairId).toBeTruthy();
    expect(pair[0].transferPairId).toBe(pair[1].transferPairId);
    expect(pair.find((x) => x.kind === "debit")!.accountId).toBe(ACC.cash);
    expect(pair.find((x) => x.kind === "credit")!.accountId).toBe(ACC.bank);
    expect(await balanceOf(ACC.cash)).toBe(cash - 1000);
    expect(await balanceOf(ACC.bank)).toBe(bank + 1000);
  });

  it("rejects same-account, non-positive and unknown-account transfers", async () => {
    const t = { note: "", date: "2026-09-28T10:00:00" };
    expect(await field(accountsService.transfer({ from: ACC.cash, to: ACC.cash, amount: 5, ...t }))).toEqual({ to: "same_account" });
    expect(await field(accountsService.transfer({ from: ACC.cash, to: ACC.bank, amount: 0, ...t }))).toEqual({ amount: "positive" });
    await expect(accountsService.transfer({ from: ACC.cash, to: "nope", amount: 5, ...t })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an overdraft unless the account allows it", async () => {
    const t = { note: "", date: "2026-09-28T10:00:00" };
    const over = (await balanceOf(ACC.nagad)) + 1;
    expect(await field(accountsService.transfer({ from: ACC.nagad, to: ACC.bank, amount: over, ...t }))).toEqual({ amount: "overdraft" });
    getDB().accounts.find((a) => a.id === ACC.nagad)!.allowOverdraft = true;
    await accountsService.transfer({ from: ACC.nagad, to: ACC.bank, amount: over, ...t });
    expect(await balanceOf(ACC.nagad)).toBe(-1);
  });

  it("a deposit credits the account, and debits the source when one is given", async () => {
    const [cash, bank] = [await balanceOf(ACC.cash), await balanceOf(ACC.bank)];
    await accountsService.deposit({ accountId: ACC.bank, amount: 200, note: "Owner", date: "2026-09-28T10:00:00" });
    expect(await balanceOf(ACC.bank)).toBe(bank + 200);
    await accountsService.deposit({ accountId: ACC.bank, fromAccountId: ACC.cash, amount: 300, note: "Cash in", date: "2026-09-28T10:00:00" });
    expect(await balanceOf(ACC.bank)).toBe(bank + 500);
    expect(await balanceOf(ACC.cash)).toBe(cash - 300);
    const pair = getDB().accountTxns.filter((x) => x.subType === "deposit" && x.note === "Cash in");
    expect(pair[0].transferPairId).toBe(pair[1].transferPairId);
    expect(await field(accountsService.deposit({ accountId: ACC.bank, fromAccountId: ACC.bank, amount: 1, note: "", date: "2026-09-28T10:00:00" }))).toEqual({ fromAccountId: "same_account" });
  });

  it("closing needs a zero balance; closed accounts can't be posted to; reopen works", async () => {
    expect(await field(accountsService.close(ACC.cash))).toEqual({ balance: "not_zero" });
    const { id } = await accountsService.save({ ...base });
    await accountsService.close(id);
    const t = { note: "", date: "2026-09-28T10:00:00" };
    expect(await field(accountsService.transfer({ from: ACC.cash, to: id, amount: 5, ...t }))).toEqual({ to: "closed" });
    expect(await field(accountsService.deposit({ accountId: id, amount: 5, ...t }))).toEqual({ accountId: "closed" });
    await accountsService.reopen(id);
    await accountsService.deposit({ accountId: id, amount: 5, ...t });
    expect(await balanceOf(id)).toBe(5);
  });

  it("book runs a balance across the range and carries the earlier balance forward", async () => {
    const { id } = await accountsService.save({ ...base, openingBalance: 100 });
    await accountsService.deposit({ accountId: id, amount: 50, note: "a", date: "2026-09-10T09:00:00" });
    await accountsService.deposit({ accountId: id, amount: 25, note: "b", date: "2026-09-20T09:00:00" });
    await accountsService.transfer({ from: id, to: ACC.cash, amount: 40, note: "c", date: "2026-09-21T09:00:00" });
    const all = await accountsService.book(id, {});
    expect(all.rows.map((r) => r.balance).slice(-3)).toEqual([150, 175, 135]);
    expect(all.closing).toBe(await balanceOf(id));
    const part = await accountsService.book(id, { from: "2026-09-15", to: "2026-09-30" });
    expect(part.opening).toBe(150);
    expect(part.rows.map((r) => [r.credit, r.debit, r.balance])).toEqual([[25, 0, 175], [0, 40, 135]]);
    expect(part.closing).toBe(135);
  });

  it("requires account.manage to write", async () => {
    useSession.setState({ userId: "user_cashier" });
    await expect(accountsService.save({ ...base })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(accountsService.transfer({ from: ACC.cash, to: ACC.bank, amount: 1, note: "", date: "2026-09-28T10:00:00" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  describe("account types", () => {
    it("allow one level of sub-type, and can't be deleted while accounts or sub-types use them", async () => {
      const types = crud("accountTypes");
      const top = await types.create({ name: "Loans", parentId: null });
      const sub = await types.create({ name: "Bank loan", parentId: top.id });
      expect(await field(types.create({ name: "Deep", parentId: sub.id }))).toEqual({ parentId: "invalid_parent" });
      expect(await code(types.remove(top.id))).toBe("category_has_children");
      const { id } = await accountsService.save({ ...base, typeId: sub.id });
      expect(await code(types.remove(sub.id))).toBe("account_type_in_use");
      await accountsService.close(id);
      expect(await code(types.remove(sub.id))).toBe("account_type_in_use");
    });
  });

  describe("payment account report", () => {
    const unlinked = async () => {
      // A cash expense paid with no account linked (e.g. a method the location has no account for).
      const { expensesService } = await import("./expenses");
      const { id } = await expensesService.save({ locationId: "loc_rango", categoryId: "exp_rent", date: "2026-09-20T10:00:00", note: "", isRefund: false, amount: 90, payments: [{ method: "other", amount: 90 }] });
      const t = getDB().transactions.find((x) => x.id === id)!;
      return { t, p: t.payments[0] };
    };

    it("lists payments with their account, and the unlinked ones on their own", async () => {
      const { p } = await unlinked();
      const all = await accountsService.paymentReport({ pageSize: -1 });
      expect(all.total).toBeGreaterThan(100);
      const row = all.rows.find((r) => r.paymentId === p.id)!;
      expect(row).toMatchObject({ amount: 90, type: "expense", accountId: null, accountName: "" });
      const only = await accountsService.paymentReport({ linked: "unlinked", pageSize: -1 });
      expect(only.rows.some((r) => r.paymentId === p.id)).toBe(true);
      expect(only.rows.every((r) => !r.accountId)).toBe(true);
      const cash = await accountsService.paymentReport({ accountId: ACC.cash, pageSize: -1 });
      expect(cash.rows.every((r) => r.accountId === ACC.cash)).toBe(true);
    });

    it("linking an account posts the matching entry in the right direction, once", async () => {
      const { t, p } = await unlinked();
      const before = await balanceOf(ACC.bank);
      await accountsService.linkAccount(t.id, p.id, ACC.bank);
      expect(await balanceOf(ACC.bank)).toBe(before - 90);
      expect(getDB().accountTxns.filter((a) => a.paymentId === p.id)).toMatchObject([{ accountId: ACC.bank, kind: "debit", amount: 90, transactionId: t.id }]);
      expect(getDB().transactions.find((x) => x.id === t.id)!.payments[0].accountId).toBe(ACC.bank);
      await accountsService.linkAccount(t.id, p.id, ACC.cash); // moving it must not leave a second entry
      expect(getDB().accountTxns.filter((a) => a.paymentId === p.id)).toHaveLength(1);
      expect(await balanceOf(ACC.bank)).toBe(before);
    });

    it("money received credits the account (a sale payment, a refund expense)", async () => {
      const sale = getDB().transactions.find((x) => x.type === "sell" && x.payments.some((p) => !p.isReturn))!;
      const pay = sale.payments.find((p) => !p.isReturn)!;
      await accountsService.linkAccount(sale.id, pay.id, ACC.nagad);
      expect(getDB().accountTxns.find((a) => a.paymentId === pay.id)).toMatchObject({ kind: "credit", accountId: ACC.nagad });
      const { expensesService } = await import("./expenses");
      const { id } = await expensesService.save({ locationId: "loc_rango", categoryId: "exp_rent", date: "2026-09-20T10:00:00", note: "", isRefund: true, amount: 40, payments: [{ method: "other", amount: 40 }] });
      const rp = getDB().transactions.find((x) => x.id === id)!.payments[0];
      await accountsService.linkAccount(id, rp.id, ACC.cash);
      expect(getDB().accountTxns.find((a) => a.paymentId === rp.id)).toMatchObject({ kind: "credit", accountId: ACC.cash });
    });

    it("refuses closed accounts, unknown payments, and needs account.manage", async () => {
      const { t, p } = await unlinked();
      const { id } = await accountsService.save({ ...base });
      await accountsService.close(id);
      expect(await field(accountsService.linkAccount(t.id, p.id, id))).toEqual({ accountId: "closed" });
      await expect(accountsService.linkAccount(t.id, "nope", ACC.cash)).rejects.toBeInstanceOf(NotFoundError);
      await expect(accountsService.linkAccount("nope", p.id, ACC.cash)).rejects.toBeInstanceOf(NotFoundError);
      useSession.setState({ userId: "user_cashier" });
      await expect(accountsService.linkAccount(t.id, p.id, ACC.cash)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
