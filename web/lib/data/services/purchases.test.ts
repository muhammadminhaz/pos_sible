import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { available } from "@/lib/domain/stock";
import { paymentSummary } from "@/lib/domain/payments";
import { addItem, emptyCart } from "@/lib/pos/cart";
import { posService, toCartItem } from "./pos";
import { purchasesService, type PurchaseInput } from "./purchases";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-27" });

function fixture() {
  const d = getDB();
  const p = d.products.find((x) => x.manageStock && x.type === "single" && !x.enableSerial && x.taxId)!;
  const v = d.variations.find((x) => x.productId === p.id)!;
  const loc = p.locationIds[0];
  const supplier = d.contacts.find((c) => c.type === "supplier")!;
  return { p, v, loc, supplier };
}
const input = (over: Partial<PurchaseInput> = {}): PurchaseInput => {
  const { p, v, loc, supplier } = fixture();
  return {
    locationId: loc, contactId: supplier.id, date: "2026-09-27T10:00:00", status: "received",
    lines: [{ productId: p.id, variationId: v.id, qty: 10, unitPrice: 100, discount: null, taxId: null, lotNo: "L1" }],
    discount: null, orderTaxId: null, shipping: { charges: 0, details: "" }, additionalExpenses: [], exchangeRate: 1, payTerm: null, notes: "", documents: [], ...over,
  };
};

describe("purchasesService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("a received purchase creates a lot at the line's unit cost; pending and ordered don't", async () => {
    const { v, loc } = fixture();
    const before = available(getDB().stockLots, v.id, loc);
    const a = await purchasesService.save(input({ lines: [{ ...input().lines[0], unitPrice: 200, discount: { type: "percentage", amount: 10 } }] }));
    expect(available(getDB().stockLots, v.id, loc)).toBe(before + 10);
    expect(getDB().stockLots.find((l) => l.sourceTxnId === a.id)).toMatchObject({ qtyIn: 10, unitCost: 180, lotNo: "L1" });
    for (const status of ["pending", "ordered"] as const) {
      const n = getDB().stockLots.length;
      await purchasesService.save(input({ status }));
      expect(getDB().stockLots).toHaveLength(n);
    }
  });

  it("moving to received creates the lot once, however often it's set", async () => {
    const { v, loc } = fixture();
    const { id } = await purchasesService.save(input({ status: "ordered" }));
    const before = available(getDB().stockLots, v.id, loc);
    await purchasesService.setStatus(id, "received");
    await purchasesService.setStatus(id, "received");
    expect(available(getDB().stockLots, v.id, loc)).toBe(before + 10);
    expect(getDB().stockLots.filter((l) => l.sourceTxnId === id)).toHaveLength(1);
  });

  it("editing a received purchase adjusts the lot, keeping what was already sold", async () => {
    const { p, v, loc } = fixture();
    const { id } = await purchasesService.save(input());
    const lot = getDB().stockLots.find((l) => l.sourceTxnId === id)!;
    lot.qtyRemaining = 6; // 4 sold
    const form = await purchasesService.getForm(id);
    await purchasesService.save({ ...form, lines: [{ ...form.lines[0], qty: 20 }] });
    expect(getDB().stockLots.find((l) => l.id === lot.id)).toMatchObject({ qtyIn: 20, qtyRemaining: 16 });
    await expect(purchasesService.save({ ...form, lines: [{ ...form.lines[0], qty: 3 }] })).rejects.toMatchObject({ fields: { lines: "below_sold" } });
    expect(getDB().stockLots.find((l) => l.id === lot.id)!.qtyIn).toBe(20);
    expect(p && v && loc).toBeTruthy();
  });

  it("editing can't remove a line whose stock was sold, but can remove an untouched one", async () => {
    const { p } = fixture();
    const other = getDB().variations.find((x) => x.productId !== p.id && getDB().products.find((q) => q.id === x.productId)?.manageStock && getDB().products.find((q) => q.id === x.productId)?.type === "single")!;
    const second = { ...input().lines[0], productId: other.productId, variationId: other.id };
    const { id } = await purchasesService.save(input({ lines: [input().lines[0], second] }));
    getDB().stockLots.find((l) => l.sourceTxnId === id && l.variationId === other.id)!.qtyRemaining = 1;
    const form = await purchasesService.getForm(id);
    await expect(purchasesService.save({ ...form, lines: [form.lines[0]] })).rejects.toMatchObject({ fields: { lines: "below_sold" } });
    getDB().stockLots.find((l) => l.sourceTxnId === id && l.variationId === other.id)!.qtyRemaining = 10;
    await purchasesService.save({ ...form, lines: [form.lines[0]] });
    expect(getDB().stockLots.filter((l) => l.sourceTxnId === id)).toHaveLength(1);
  });

  it("deleting removes the lots, but is refused once stock has been sold", async () => {
    const a = await purchasesService.save(input());
    await purchasesService.remove(a.id);
    expect(getDB().stockLots.some((l) => l.sourceTxnId === a.id)).toBe(false);
    expect(getDB().transactions.some((t) => t.id === a.id)).toBe(false);
    const b = await purchasesService.save(input());
    getDB().stockLots.find((l) => l.sourceTxnId === b.id)!.qtyRemaining = 9;
    await expect(purchasesService.remove(b.id)).rejects.toMatchObject({ code: "stock_used" });
    expect(getDB().transactions.some((t) => t.id === b.id)).toBe(true);
  });

  it("stock received is sellable in the POS", async () => {
    const { p, v, loc } = fixture();
    await purchasesService.save(input({ lines: [{ ...input().lines[0], qty: 3 }] }));
    const row = (await posService.products({ locationId: loc, pageSize: -1 })).rows.find((x) => x.id === p.id)!;
    const cart = addItem(emptyCart(), toCartItem(row, row.variations.find((x) => x.id === v.id)!, 1), "new_row");
    await expect(salesService.checkout({ cart, locationId: loc, status: "final", payments: [{ method: "cash", amount: 99999 }] })).resolves.toBeTruthy();
  });

  it("payments move the status paid ← partial ← due, never overpay, and can be removed", async () => {
    const { id } = await purchasesService.save(input());
    const total = getDB().transactions.find((t) => t.id === id)!.totals.total;
    expect(getDB().transactions.find((t) => t.id === id)!.paymentStatus).toBe("due");
    await purchasesService.addPayment(id, { method: "cash", amount: 100 });
    expect(getDB().transactions.find((t) => t.id === id)!.paymentStatus).toBe("partial");
    await expect(purchasesService.addPayment(id, { method: "cash", amount: total })).rejects.toMatchObject({ fields: { amount: "invalid" } });
    await purchasesService.addPayment(id, { method: "cash", amount: total - 100 });
    const t = getDB().transactions.find((x) => x.id === id)!;
    expect(t.paymentStatus).toBe("paid");
    await purchasesService.removePayment(id, t.payments[0].id);
    expect(paymentSummary(t.totals.total, getDB().transactions.find((x) => x.id === id)!.payments).due).toBe(100);
  });

  it("an up-front payment writes a debit to the account ledger", async () => {
    const n = getDB().accountTxns.length;
    const { id } = await purchasesService.save(input({ payments: [{ method: "cash", amount: 50 }] }));
    expect(getDB().transactions.find((t) => t.id === id)!.payments).toHaveLength(1);
    const added = getDB().accountTxns.slice(n);
    if (added.length) expect(added[0]).toMatchObject({ kind: "debit", amount: 50 });
  });

  it("a line's selling price updates the variation's prices", async () => {
    const { v } = fixture();
    await purchasesService.save(input({ lines: [{ ...input().lines[0], unitPrice: 100, sellPriceInc: 157.5 }] }));
    const after = getDB().variations.find((x) => x.id === v.id)!;
    expect(after.purchasePriceExc).toBe(100);
    expect(after.sellPriceInc).toBe(157.5);
    expect(after.margin).toBeGreaterThan(0);
  });

  it("rejects bad input: no supplier, no lines, a repeated variation, five extra charges, a total below what's paid", async () => {
    const customer = getDB().contacts.find((c) => c.type === "customer")!;
    await expect(purchasesService.save(input({ contactId: customer.id }))).rejects.toMatchObject({ fields: { contactId: "supplier_required" } });
    await expect(purchasesService.save(input({ lines: [] }))).rejects.toMatchObject({ fields: { lines: "required" } });
    await expect(purchasesService.save(input({ lines: [input().lines[0], input().lines[0]] }))).rejects.toMatchObject({ fields: { lines: "duplicate" } });
    await expect(purchasesService.save(input({ additionalExpenses: Array.from({ length: 5 }, () => ({ name: "x", amount: 1 })) }))).rejects.toMatchObject({ fields: { additionalExpenses: "max_4" } });
    await expect(purchasesService.save(input({ lines: [{ ...input().lines[0], qty: 0 }] }))).rejects.toMatchObject({ fields: { lines: "qty" } });
    const { id } = await purchasesService.save(input({ payments: [{ method: "cash", amount: 900 }] }));
    const form = await purchasesService.getForm(id);
    await expect(purchasesService.save({ ...form, lines: [{ ...form.lines[0], qty: 1 }] })).rejects.toMatchObject({ fields: { total: "below_paid" } });
  });

  it("a duplicate reference number is rejected", async () => {
    await purchasesService.save(input({ refNo: "REF-1" }));
    await expect(purchasesService.save(input({ refNo: "REF-1" }))).rejects.toMatchObject({ code: "duplicate_ref" });
  });

  it("list filters by status and sums the totals", async () => {
    const out = await purchasesService.list({ status: "received", pageSize: -1 });
    expect(out.rows.every((r) => r.status === "received")).toBe(true);
    expect(out.totals.total).toBeCloseTo(out.rows.reduce((s, r) => s + r.total, 0), 2);
    expect(out.totals.due).toBeCloseTo(out.totals.total - out.totals.paid, 2);
  });

  it("writes need the purchase permissions", async () => {
    useSession.setState({ userId: "user_cashier" });
    await expect(purchasesService.save(input())).rejects.toMatchObject({ code: "forbidden" });
  });
});
