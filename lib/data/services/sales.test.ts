import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { AppError, CreditLimitError, InsufficientStockError, ProductUnavailableError, SerialsRequiredError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO, WALK_IN } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart, patchCart, setContact, setSerials, type Cart } from "@/lib/pos/cart";
import { posService, toCartItem, type PosProduct } from "./pos";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

async function stocked(pred: (p: PosProduct) => boolean = () => true) {
  const rows = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows;
  return rows.find((p) => p.type !== "combo" && p.manageStock && !p.enableSerial && p.stock >= 2 && p.variations[0].stock >= 2 && pred(p))!;
}
const cartWith = (p: PosProduct, qty = 1): Cart => addItem(emptyCart(), toCartItem(p, p.variations[0], qty));
const customer = () => getDB().contacts.find((c) => c.type === "customer" && !c.isDefault && c.creditLimit == null)!;

describe("salesService.checkout", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_cashier" });
  });

  it("cash sale: invoice number, stock, ledger, paid", async () => {
    const p = await stocked();
    const cart = cartWith(p, 2);
    const scheme = getDB().invoiceSchemes.find((s) => s.id === getDB().locations.find((l) => l.id === LOC_RANGO)!.invoiceSchemeId)!;
    const countBefore = scheme.count;
    const stockBefore = p.variations[0].stock;
    const total = (await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [] }).catch((e) => e)) as AppError;
    expect(total).toBeInstanceOf(AppError); // walk-in with no payment = credit → rejected
    expect(total.code).toBe("walk_in_credit");

    const probe = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "quotation" });
    const payable = probe.total;
    const res = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: payable + 20 }] });
    expect(res).toMatchObject({ status: "final", paid: payable + 20, change: 20, due: 0 });

    const db = getDB();
    const t = db.transactions.find((x) => x.id === res.id)!;
    expect(t).toMatchObject({ type: "sell", status: "final", channel: "pos", paymentStatus: "paid", createdBy: "user_cashier", contactId: WALK_IN });
    expect(db.invoiceSchemes.find((s) => s.id === scheme.id)!.count).toBe(countBefore + 1);
    expect(t.payments.map((x) => [x.method, x.amount, x.isReturn])).toEqual([["cash", payable + 20, false], ["cash", 20, true]]);
    expect(db.accountTxns.filter((a) => a.transactionId === t.id).map((a) => a.kind)).toEqual(["credit", "debit"]);
    const left = db.stockLots.filter((l) => l.variationId === p.variations[0].id && l.locationId === LOC_RANGO).reduce((s, l) => s + l.qtyRemaining, 0);
    expect(left).toBeCloseTo(stockBefore - 2, 4);
    expect(t.lines[0].allocations.length).toBeGreaterThan(0);
  });

  it("split payment bKash + cash", async () => {
    const p = await stocked();
    const cart = cartWith(p);
    const { total } = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "quotation" });
    const res = await salesService.checkout({
      cart, locationId: LOC_RANGO, status: "final",
      payments: [{ method: "custom_pay_1", amount: 1, details: { txnNo: "ABC123" } }, { method: "cash", amount: total - 1 }],
    });
    const t = getDB().transactions.find((x) => x.id === res.id)!;
    expect(t.payments.map((x) => x.method)).toEqual(["custom_pay_1", "cash"]);
    expect(t.payments[0].details.txnNo).toBe("ABC123");
  });

  it("rejects non-cash overpayment", async () => {
    const p = await stocked();
    await expect(
      salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "card", amount: 10_000_000 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("insufficient stock writes nothing", async () => {
    const p = await stocked();
    const before = structuredClone(getDB());
    const cart = addItem(emptyCart(), { ...toCartItem(p, p.variations[0]), qty: p.variations[0].stock + 1000 });
    commit((d) => { d.settings.sale.allowOverselling = false; });
    const snapshot = structuredClone(getDB());
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e9 }] })).rejects.toBeInstanceOf(InsufficientStockError);
    expect(getDB()).toEqual(snapshot);
    expect(before.transactions.length).toBe(getDB().transactions.length);
  });

  it("serial products need one serial per unit", async () => {
    const rows = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows;
    const phone = rows.find((p) => p.enableSerial && p.stock >= 1)!;
    let cart = addItem(emptyCart(), toCartItem(phone, phone.variations.find((v) => v.stock >= 1)!));
    const { total } = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "quotation" });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: total }] })).rejects.toBeInstanceOf(SerialsRequiredError);
    cart = setSerials(cart, cart.lines[0].key, ["356789012345678"]);
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: total }] })).resolves.toMatchObject({ status: "final" });
  });

  it("product deactivated after it was added", async () => {
    const p = await stocked();
    const cart = cartWith(p);
    commit((d) => { d.products.find((x) => x.id === p.id)!.active = false; });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "suspended" })).rejects.toBeInstanceOf(ProductUnavailableError);
  });

  it("credit sale to a named customer updates due and points", async () => {
    const p = await stocked();
    const c = customer();
    const pointsBefore = c.points;
    const res = await salesService.checkout({ cart: setContact(cartWith(p), c.id), locationId: LOC_RANGO, status: "final", payments: [] });
    expect(res.due).toBe(res.total);
    const t = getDB().transactions.find((x) => x.id === res.id)!;
    expect(t.paymentStatus).toBe("due");
    expect(getDB().contacts.find((x) => x.id === c.id)!.points).toBe(pointsBefore + t.pointsEarned);
  });

  it("credit limit is enforced", async () => {
    const p = await stocked();
    const c = customer();
    commit((d) => { d.contacts.find((x) => x.id === c.id)!.creditLimit = 1; });
    await expect(salesService.checkout({ cart: setContact(cartWith(p), c.id), locationId: LOC_RANGO, status: "final", payments: [] })).rejects.toBeInstanceOf(CreditLimitError);
  });

  it("suspend, resume into a cart, finalize replaces the suspended sale", async () => {
    const p = await stocked();
    const s = await salesService.checkout({ cart: cartWith(p, 2), locationId: LOC_RANGO, status: "suspended", staffNote: "Back in 5" });
    expect(s.refNo).toMatch(/^DR\d{4}\/\d{4}$/);
    const rows = await salesService.list({ locationId: LOC_RANGO, status: "suspended" });
    expect(rows.find((r) => r.id === s.id)).toMatchObject({ note: "Back in 5", itemsCount: 2 });

    const cart = await salesService.toCart(s.id);
    expect(cart).toMatchObject({ resumedFromId: s.id });
    expect(cart.lines[0]).toMatchObject({ variationId: p.variations[0].id, qty: 2, name: expect.any(String) });

    const res = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: s.total }] });
    expect(getDB().transactions.some((t) => t.id === s.id)).toBe(false);
    expect(getDB().transactions.some((t) => t.id === res.id)).toBe(true);
  });

  it("points redemption is capped by balance", async () => {
    const p = await stocked();
    const c = customer();
    const cart = patchCart(setContact(cartWith(p), c.id), { pointsRedeemed: c.points + 1 });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("receipt resolves names and payment summary", async () => {
    const p = await stocked();
    const { total } = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "quotation" });
    const res = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: total + 5 }] });
    const r = await salesService.receipt(res.id);
    expect(r.lines[0].name).toBe(p.name);
    expect(r).toMatchObject({ paid: total + 5, change: 5, due: 0, customer: { isWalkIn: true } });
    expect(r.cashier.length).toBeGreaterThan(0);
  });

  it("remove deletes drafts but refuses final sales", async () => {
    const p = await stocked();
    const d = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "draft" });
    await salesService.remove(d.id);
    expect(getDB().transactions.some((t) => t.id === d.id)).toBe(false);
    const f = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] });
    await expect(salesService.remove(f.id)).rejects.toMatchObject({ code: "not_deletable" });
  });
});
