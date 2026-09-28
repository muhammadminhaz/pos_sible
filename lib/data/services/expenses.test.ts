import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { expensesService } from "./expenses";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("expensesService.create", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
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
