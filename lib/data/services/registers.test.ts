import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { cashRegister, transaction, type CashRegister, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart } from "@/lib/pos/cart";
import { expensesService } from "./expenses";
import { posService, toCartItem } from "./pos";
import { registersService } from "./registers";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

let seq = 0;
/** Push a minimal transaction with a single payment directly into the DB, for exercising the activity rule's edges. */
function pushPayment(overrides: {
  type: "sell" | "sell_return" | "expense";
  locationId: string;
  createdBy: string | null;
  paidOn: string;
  amount: number;
  method?: PaymentMethod;
  isReturn?: boolean;
}) {
  commit((d) => {
    const id = `t_neg_${seq++}`;
    d.transactions.push(
      transaction.parse({
        id,
        createdAt: overrides.paidOn,
        createdBy: overrides.createdBy,
        type: overrides.type,
        status: "final",
        locationId: overrides.locationId,
        refNo: `TEST-${id}`,
        date: overrides.paidOn,
        lines: [],
        totals: { itemsCount: 0, linesTotal: overrides.amount, discount: 0, orderTax: 0, shipping: 0, additional: 0, redeemed: 0, roundOff: 0, total: overrides.amount },
        paymentStatus: "paid",
        payments: [
          {
            id: `pay_${id}`,
            refNo: `PAY-${id}`,
            amount: overrides.amount,
            method: overrides.method ?? "cash",
            accountId: null,
            paidOn: overrides.paidOn,
            note: "",
            isReturn: overrides.isReturn ?? false,
            details: {},
            createdBy: overrides.createdBy,
          },
        ],
      }),
    );
  });
}

describe("registersService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
    commit((d) => {
      for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    });
  });

  it("seeded closed register: expected cash matches its closing amount", async () => {
    const reg = getDB().cashRegisters.find((r) => r.userId === "user_cashier" && r.status === "close" && r.closingAmount != null && r.closedAt !== r.openedAt)!;
    const s = await registersService.summary(reg.id);
    expect(s.expectedCash).toBeCloseTo(reg.closingAmount!, 2);
    expect(s.cardSlips).toBe(reg.totalCardSlips);
  });

  it("open → one per user/location, sale and expense flow into the summary, close", async () => {
    expect(await registersService.current(LOC_RANGO)).toBeNull();
    const reg = await registersService.open(LOC_RANGO, 2000);
    expect(await registersService.current(LOC_RANGO)).toMatchObject({ id: reg.id, openingCash: 2000, status: "open" });
    await expect(registersService.open(LOC_RANGO, 100)).rejects.toMatchObject({ code: "register_open" });

    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock && !x.enableSerial && x.variations[0].stock >= 1)!;
    const cart = addItem(emptyCart(), toCartItem(p, p.variations[0]));
    const sale = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e6 }] });
    await expensesService.create({ locationId: LOC_RANGO, categoryId: getDB().expenseCategories[0].id, amount: 100, method: "cash" });

    const s = await registersService.summary(reg.id);
    expect(s.byMethod.find((m) => m.method === "cash")).toMatchObject({ amount: 1e6, count: 1 });
    expect(s).toMatchObject({ opening: 2000, change: sale.change, expenses: 100, sellsCount: 1 });
    expect(s.expectedCash).toBeCloseTo(2000 + sale.total - 100, 2);
    expect(s.totalSales).toBeCloseTo(sale.total, 2);

    const closed = await registersService.close(reg.id, { closingAmount: s.expectedCash, totalCardSlips: 0, totalCheques: 0, closingNote: "ok", denominations: { "1000": 2 } });
    expect(closed).toMatchObject({ status: "close", closingAmount: s.expectedCash, closingNote: "ok" });
    expect(closed.closedAt).not.toBeNull();
    expect(await registersService.current(LOC_RANGO)).toBeNull();
  });

  it("summary excludes payments created by a different user", async () => {
    const reg = await registersService.open(LOC_RANGO, 2000);
    const baseline = await registersService.summary(reg.id);
    pushPayment({ type: "sell", locationId: LOC_RANGO, createdBy: "user_manager", paidOn: reg.openedAt, amount: 500 });
    const s = await registersService.summary(reg.id);
    expect(s.byMethod).toEqual(baseline.byMethod);
    expect(s.expectedCash).toBeCloseTo(baseline.expectedCash, 2);
  });

  it("summary excludes payments on a transaction at a different location", async () => {
    const reg = await registersService.open(LOC_RANGO, 2000);
    const baseline = await registersService.summary(reg.id);
    pushPayment({ type: "sell", locationId: LOC_NIPUN, createdBy: "user_cashier", paidOn: reg.openedAt, amount: 500 });
    const s = await registersService.summary(reg.id);
    expect(s.byMethod).toEqual(baseline.byMethod);
    expect(s.expectedCash).toBeCloseTo(baseline.expectedCash, 2);
  });

  it("summary excludes payments before openedAt or after closedAt on a closed register", async () => {
    // A date far outside the seed's history/today, so no real seeded transaction falls inside the window.
    let reg!: CashRegister;
    commit((d) => {
      reg = cashRegister.parse({
        id: "reg_window_test",
        createdAt: "2099-01-01T09:00:00",
        createdBy: "user_cashier",
        userId: "user_cashier",
        locationId: LOC_RANGO,
        openedAt: "2099-01-01T09:00:00",
        closedAt: "2099-01-01T18:00:00",
        openingCash: 2000,
        status: "close",
      });
      d.cashRegisters.push(reg);
    });
    pushPayment({ type: "sell", locationId: LOC_RANGO, createdBy: "user_cashier", paidOn: "2099-01-01T08:59:00", amount: 500 });
    pushPayment({ type: "sell", locationId: LOC_RANGO, createdBy: "user_cashier", paidOn: "2099-01-01T18:00:01", amount: 700 });
    const s = await registersService.summary(reg.id);
    expect(s.byMethod).toEqual([]);
    expect(s.expectedCash).toBeCloseTo(2000, 2);
  });

  it("close rejects an already-closed register and writes nothing", async () => {
    const reg = await registersService.open(LOC_RANGO, 2000);
    const closed = await registersService.close(reg.id, { closingAmount: 2000, totalCardSlips: 0, totalCheques: 0, closingNote: "first", denominations: {} });
    await expect(
      registersService.close(reg.id, { closingAmount: 9999, totalCardSlips: 5, totalCheques: 5, closingNote: "second", denominations: { "500": 1 } }),
    ).rejects.toMatchObject({ code: "register_closed" });
    const stored = getDB().cashRegisters.find((r) => r.id === reg.id)!;
    expect(stored.closingAmount).toBe(closed.closingAmount);
    expect(stored.closedAt).toBe(closed.closedAt);
    expect(stored.closingNote).toBe("first");
  });

  it("open rejects a second register for the same user and location", async () => {
    await registersService.open(LOC_RANGO, 2000);
    await expect(registersService.open(LOC_RANGO, 500)).rejects.toMatchObject({ code: "register_open" });
    const openRegs = getDB().cashRegisters.filter((r) => r.userId === "user_cashier" && r.locationId === LOC_RANGO && r.status === "open");
    expect(openRegs).toHaveLength(1);
  });
});
