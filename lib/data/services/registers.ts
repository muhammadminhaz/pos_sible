import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError } from "@/lib/data/errors";
import { cashRegister, type CashRegister, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, uid } from "./_util";

export type RegisterSummary = {
  register: CashRegister;
  byMethod: { method: PaymentMethod; amount: number; count: number }[];
  opening: number;
  cashIn: number;
  change: number;
  refunds: number;
  expenses: number;
  expectedCash: number;
  totalSales: number;
  cardSlips: number;
  cheques: number;
  sellsCount: number;
};

export type CloseRegisterInput = {
  closingAmount: number;
  totalCardSlips: number;
  totalCheques: number;
  closingNote: string;
  denominations: Record<string, number>;
};

const me = () => {
  const id = currentUser()?.user.id;
  if (!id) throw new AppError("Not signed in", "unauthenticated");
  return id;
};

export const registersService = {
  async current(locationId: string): Promise<CashRegister | null> {
    await delay();
    const userId = currentUser()?.user.id;
    return getDB().cashRegisters.find((r) => r.userId === userId && r.locationId === locationId && r.status === "open") ?? null;
  },

  async open(locationId: string, openingCash: number): Promise<CashRegister> {
    await delay();
    const userId = me();
    let created!: CashRegister;
    commit((d) => {
      if (d.cashRegisters.some((r) => r.userId === userId && r.locationId === locationId && r.status === "open")) {
        throw new AppError("A register is already open", "register_open");
      }
      const at = nowISO();
      created = cashRegister.parse({
        id: uid("reg"),
        createdAt: at,
        createdBy: userId,
        userId,
        locationId,
        openedAt: at,
        closedAt: null,
        openingCash: roundMoney(Math.max(0, openingCash)),
        status: "open",
      });
      d.cashRegisters.push(created);
    });
    return created;
  },

  async summary(id: string): Promise<RegisterSummary> {
    await delay();
    const d = getDB();
    const register = d.cashRegisters.find((r) => r.id === id);
    if (!register) throw new NotFoundError("Cash register");
    const end = register.closedAt ?? nowISO();
    const methods = new Map<PaymentMethod, { amount: number; count: number }>();
    let change = 0;
    let refunds = 0;
    let expenses = 0;
    const sells = new Set<string>();

    for (const t of d.transactions) {
      if (t.locationId !== register.locationId) continue;
      for (const p of t.payments) {
        if (p.createdBy !== register.userId || p.paidOn < register.openedAt || p.paidOn > end) continue;
        if (t.type === "sell") {
          if (p.isReturn) {
            if (p.method === "cash") change += p.amount;
            continue;
          }
          const m = methods.get(p.method) ?? { amount: 0, count: 0 };
          methods.set(p.method, { amount: m.amount + p.amount, count: m.count + 1 });
          sells.add(t.id);
        } else if (t.type === "sell_return" && p.method === "cash") {
          refunds += p.amount;
        } else if (t.type === "expense" && p.method === "cash") {
          expenses += p.amount;
        }
      }
    }

    const byMethod = [...methods.entries()]
      .map(([method, v]) => ({ method, amount: roundMoney(v.amount), count: v.count }))
      .sort((a, b) => (a.method === "cash" ? -1 : b.method === "cash" ? 1 : b.amount - a.amount));
    const cashIn = byMethod.find((m) => m.method === "cash")?.amount ?? 0;
    const total = byMethod.reduce((s, m) => s + m.amount, 0);
    return {
      register,
      byMethod,
      opening: register.openingCash,
      cashIn,
      change: roundMoney(change),
      refunds: roundMoney(refunds),
      expenses: roundMoney(expenses),
      expectedCash: roundMoney(register.openingCash + cashIn - change - refunds - expenses),
      totalSales: roundMoney(total - change),
      cardSlips: methods.get("card")?.count ?? 0,
      cheques: methods.get("cheque")?.count ?? 0,
      sellsCount: sells.size,
    };
  },

  async close(id: string, input: CloseRegisterInput): Promise<CashRegister> {
    await delay();
    assertCan("cash_register.close");
    let closed!: CashRegister;
    commit((d) => {
      const r = d.cashRegisters.find((x) => x.id === id);
      if (!r) throw new NotFoundError("Cash register");
      if (r.status === "close") throw new AppError("Register already closed", "register_closed");
      Object.assign(r, {
        status: "close",
        closedAt: nowISO(),
        closingAmount: roundMoney(input.closingAmount),
        totalCardSlips: input.totalCardSlips,
        totalCheques: input.totalCheques,
        closingNote: input.closingNote.trim(),
        denominations: input.denominations,
      });
      closed = { ...r };
    });
    return closed;
  },
};
