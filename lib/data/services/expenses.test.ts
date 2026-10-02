import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { expensesService } from "./expenses";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("expensesService.create", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
    getDB().roles.find((r) => r.id === "role_cashier")!.permissions.push("expense.create"); // the seeded cashier lacks these
  });

  it("records a paid expense with a ledger debit", async () => {
    const cat = getDB().expenseCategories[0];
    const t = await expensesService.create({ locationId: LOC_RANGO, categoryId: cat.id, amount: 250, method: "cash", note: "Tea" });
    expect(t).toMatchObject({ type: "expense", status: "final", paymentStatus: "paid", createdBy: "user_cashier", notes: "Tea" });
    expect(t.refNo).toMatch(/^EP\d{4}\/\d{4}$/);
    expect(t.payments[0]).toMatchObject({ amount: 250, method: "cash", createdBy: "user_cashier" });
    const at = getDB().accountTxns.find((a) => a.paymentId === t.payments[0].id)!;
    expect(at).toMatchObject({ kind: "debit", amount: 250, subType: "payment" });
  });

  it("rejects non-positive amounts", async () => {
    const cat = getDB().expenseCategories[0];
    await expect(expensesService.create({ locationId: LOC_RANGO, categoryId: cat.id, amount: 0, method: "cash" })).rejects.toBeInstanceOf(ValidationError);
  });
});

const bal = (accountId: string) =>
  getDB().accountTxns.filter((a) => a.accountId === accountId).reduce((s, a) => s + (a.kind === "credit" ? a.amount : -a.amount), 0);
const CASH = () => getDB().locations.find((l) => l.id === LOC_RANGO)!.defaultAccounts.cash!;
const base = { locationId: LOC_RANGO, categoryId: "exp_rent", date: "2026-09-20T10:00:00", note: "", isRefund: false } as const;

describe("expensesService.save / edit / remove", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("adds tax on top of the amount and posts each payment as a debit", async () => {
    const taxId = getDB().taxRates[0].id;
    const rate = getDB().taxRates[0].rate;
    const { id } = await expensesService.save({ ...base, amount: 1000, taxId, payments: [{ method: "cash", amount: 400 }] });
    const t = getDB().transactions.find((x) => x.id === id)!;
    expect(t.totals.total).toBeCloseTo(1000 * (1 + rate / 100), 2);
    expect(t.paymentStatus).toBe("partial");
    expect(getDB().accountTxns.filter((a) => a.transactionId === id)).toMatchObject([{ kind: "debit", amount: 400, accountId: CASH() }]);
  });

  it("editing the amount keeps one ledger row per payment (no double counting)", async () => {
    const { id } = await expensesService.save({ ...base, amount: 100, payments: [{ method: "cash", amount: 100 }] });
    const before = bal(CASH());
    await expensesService.save({ ...base, id, amount: 150, payments: [{ method: "cash", amount: 150 }] });
    expect(getDB().accountTxns.filter((a) => a.transactionId === id)).toHaveLength(1);
    expect(bal(CASH())).toBe(before - 50);
    await expensesService.save({ ...base, id, amount: 150, payments: [{ method: "cash", amount: 150 }] });
    expect(bal(CASH())).toBe(before - 50);
  });

  it("editing without payments keeps them, but not below what was paid", async () => {
    const { id } = await expensesService.save({ ...base, amount: 100, payments: [{ method: "cash", amount: 100 }] });
    await expensesService.save({ ...base, id, amount: 100, note: "x" });
    expect(getDB().accountTxns.filter((a) => a.transactionId === id)).toHaveLength(1);
    await expect(expensesService.save({ ...base, id, amount: 60 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("moves the ledger row when the location's account changes", async () => {
    const { id } = await expensesService.save({ ...base, amount: 100, payments: [{ method: "cash", amount: 100 }] });
    await expensesService.save({ ...base, id, amount: 100, payments: [{ method: "bank_transfer", amount: 100 }] });
    const rows = getDB().accountTxns.filter((a) => a.transactionId === id);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).not.toBe(CASH());
  });

  it("a refund credits the account and reverses the sign in the list totals", async () => {
    const before = bal(CASH());
    const { id } = await expensesService.save({ ...base, amount: 200, isRefund: true, payments: [{ method: "cash", amount: 200 }] });
    expect(getDB().accountTxns.find((a) => a.transactionId === id)).toMatchObject({ kind: "credit", amount: 200 });
    expect(bal(CASH())).toBe(before + 200);
    const res = await expensesService.list({ search: getDB().transactions.find((x) => x.id === id)!.refNo });
    expect(res.rows[0]).toMatchObject({ total: -200, paid: -200, due: 0 });
    expect(res.totals.total).toBe(-200);
  });

  it("a cash refund raises the register's expected cash, a cash expense lowers it", async () => {
    const { registersService } = await import("./registers");
    for (const r of getDB().cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    const reg = await registersService.open(LOC_RANGO, 1000);
    const before = (await registersService.summary(reg.id)).expectedCash;
    await expensesService.save({ ...base, date: reg.openedAt, amount: 300, payments: [{ method: "cash", amount: 300, paidOn: reg.openedAt }] });
    expect((await registersService.summary(reg.id)).expectedCash).toBe(before - 300);
    await expensesService.save({ ...base, date: reg.openedAt, amount: 500, isRefund: true, payments: [{ method: "cash", amount: 500, paidOn: reg.openedAt }] });
    expect((await registersService.summary(reg.id)).expectedCash).toBe(before + 200);
  });

  it("filters by category, sub-category, status, location, contact, user and dates", async () => {
    const sup = getDB().contacts.find((c) => c.type !== "customer")!;
    await expensesService.save({ ...base, categoryId: "exp_utility", subCategoryId: "exp_water", date: "2026-01-05T10:00:00", amount: 70, contactId: sup.id, forUserId: "user_manager" });
    const all = await expensesService.list({ pageSize: -1 });
    const one = await expensesService.list({ categoryId: "exp_utility", subCategoryId: "exp_water", contactId: sup.id, userId: "user_manager", paymentStatus: "due", from: "2026-01-01", to: "2026-01-31", locationId: LOC_RANGO });
    expect(one.rows).toHaveLength(1);
    expect(all.total).toBeGreaterThan(1);
    expect((await expensesService.list({ categoryId: "exp_rent", from: "2026-01-01", to: "2026-01-02" })).rows).toHaveLength(0);
  });

  it("rejects bad input", async () => {
    await expect(expensesService.save({ ...base, amount: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(expensesService.save({ ...base, amount: 10, categoryId: "nope" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(expensesService.save({ ...base, amount: 10, subCategoryId: "exp_water" })).rejects.toBeInstanceOf(ValidationError); // child of Utilities, not Rent
    await expect(expensesService.save({ ...base, amount: 10, payments: [{ method: "cash", amount: 11 }] })).rejects.toBeInstanceOf(ValidationError);
    const { refNo } = await expensesService.save({ ...base, amount: 10 });
    await expect(expensesService.save({ ...base, amount: 10, refNo })).rejects.toMatchObject({ code: "duplicate_ref" });
  });

  it("refuses to post to a closed account, and leaves a closed default account's payment unlinked", async () => {
    getDB().accounts.find((a) => a.id === CASH())!.status = "closed";
    await expect(expensesService.save({ ...base, amount: 10, payments: [{ method: "cash", amount: 10, accountId: CASH() }] })).rejects.toBeInstanceOf(ValidationError);
    const { id } = await expensesService.save({ ...base, amount: 10, payments: [{ method: "cash", amount: 10 }] });
    expect(getDB().transactions.find((x) => x.id === id)!.payments[0].accountId).toBeNull();
    expect(getDB().accountTxns.some((a) => a.transactionId === id)).toBe(false);
  });

  it("add/removePayment keeps status and ledger in step; remove deletes the ledger rows", async () => {
    const { id } = await expensesService.save({ ...base, amount: 100 });
    await expensesService.addPayment(id, { method: "cash", amount: 100 });
    const t = () => getDB().transactions.find((x) => x.id === id)!;
    expect(t().paymentStatus).toBe("paid");
    await expect(expensesService.addPayment(id, { method: "cash", amount: 1 })).rejects.toBeInstanceOf(ValidationError);
    await expensesService.removePayment(id, t().payments[0].id);
    expect(t().paymentStatus).toBe("due");
    expect(getDB().accountTxns.some((a) => a.transactionId === id)).toBe(false);
    await expensesService.addPayment(id, { method: "cash", amount: 40 });
    await expensesService.remove(id);
    expect(getDB().transactions.some((x) => x.id === id)).toBe(false);
    expect(getDB().accountTxns.some((a) => a.transactionId === id)).toBe(false);
  });

  it("requires permission", async () => {
    useSession.setState({ userId: "user_cashier" });
    await expect(expensesService.save({ ...base, amount: 10 })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("expensesService.create (POS)", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("files a sub-category pick under its parent so list filters find it", async () => {
    const t = await expensesService.create({ locationId: LOC_RANGO, categoryId: "exp_water", amount: 80, method: "cash" });
    expect(t).toMatchObject({ expenseCategoryId: "exp_utility", expenseSubCategoryId: "exp_water" });
  });
});

describe("expensesService.generateNext", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });
  const recurring = (repetitions: number | null) => ({ interval: 1, intervalType: "months" as const, repeatOn: null, repetitions, parentId: null });

  it("never makes more than `repetitions` copies, one interval apart", async () => {
    const { id } = await expensesService.save({ ...base, date: "2026-01-31T09:00:00", amount: 500, recurring: recurring(2) });
    const a = await expensesService.generateNext(id);
    const b = await expensesService.generateNext(id);
    expect(a.date.slice(0, 10)).toBe("2026-02-28");
    expect(b.date.slice(0, 10)).toBe("2026-03-28");
    await expect(expensesService.generateNext(id)).rejects.toMatchObject({ code: "recurrence_complete" });
    await expect(expensesService.generateNext(a.id)).rejects.toMatchObject({ code: "recurrence_complete" }); // via a copy → same parent
    expect(getDB().transactions.filter((t) => t.recurring?.parentId === id)).toHaveLength(2);
  });

  it("copies are unpaid and not themselves recurring parents; unlimited repetitions keep going", async () => {
    const { id } = await expensesService.save({ ...base, amount: 500, recurring: recurring(null), payments: [{ method: "cash", amount: 500 }] });
    const c = await expensesService.generateNext(id);
    expect(c).toMatchObject({ paymentStatus: "due", payments: [], recurring: { parentId: id } });
    await expensesService.generateNext(id);
    expect(getDB().transactions.filter((t) => t.recurring?.parentId === id)).toHaveLength(2);
  });

  it("rejects a non-recurring expense", async () => {
    const { id } = await expensesService.save({ ...base, amount: 5 });
    await expect(expensesService.generateNext(id)).rejects.toBeInstanceOf(ValidationError);
  });
});
