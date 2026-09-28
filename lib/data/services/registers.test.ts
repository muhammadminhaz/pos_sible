import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart } from "@/lib/pos/cart";
import { expensesService } from "./expenses";
import { posService, toCartItem } from "./pos";
import { registersService } from "./registers";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

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
});
