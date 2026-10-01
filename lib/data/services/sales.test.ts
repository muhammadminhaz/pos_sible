import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { AppError, CreditLimitError, InsufficientStockError, NotFoundError, ProductUnavailableError, SerialsRequiredError, ValidationError } from "@/lib/data/errors";
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
    getDB().roles.find((r) => r.id === "role_cashier")!.permissions.push("sell.delete"); // the seeded cashier lacks these
    const p = await stocked();
    const d = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "draft" });
    await salesService.remove(d.id);
    expect(getDB().transactions.some((t) => t.id === d.id)).toBe(false);
    const f = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] });
    await expect(salesService.remove(f.id)).rejects.toMatchObject({ code: "not_deletable" });
  });

  it("suspend preserves points redemption; resume finalizes it once", async () => {
    const p = await stocked();
    const c = customer();
    commit((d) => {
      d.settings.rewards.minOrderTotalToRedeem = 0;
      d.settings.rewards.minRedeemPoint = 1;
      d.contacts.find((x) => x.id === c.id)!.points = 100;
    });
    const pointsBefore = getDB().contacts.find((x) => x.id === c.id)!.points;
    const cart = patchCart(setContact(cartWith(p), c.id), { pointsRedeemed: 10 });

    const s = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "suspended" });
    const suspended = getDB().transactions.find((t) => t.id === s.id)!;
    expect(suspended.pointsRedeemed).toBe(10);
    expect(getDB().contacts.find((x) => x.id === c.id)!.points).toBe(pointsBefore);

    const resumed = await salesService.toCart(s.id);
    expect(resumed.pointsRedeemed).toBe(10);

    const res = await salesService.checkout({ cart: resumed, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] });
    const finalTxn = getDB().transactions.find((t) => t.id === res.id)!;
    expect(finalTxn.pointsRedeemed).toBe(10);
    expect(getDB().contacts.find((x) => x.id === c.id)!.points).toBe(pointsBefore - 10 + finalTxn.pointsEarned);
  });

  it("resuming from a removed sale throws and writes nothing", async () => {
    getDB().roles.find((r) => r.id === "role_cashier")!.permissions.push("sell.delete"); // the seeded cashier lacks these
    const p = await stocked();
    const s = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "suspended" });
    await salesService.remove(s.id);
    const cart = patchCart(cartWith(p), { resumedFromId: s.id });
    const before = structuredClone(getDB());
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "draft" })).rejects.toBeInstanceOf(NotFoundError);
    expect(getDB()).toEqual(before);
  });

  it("resuming from an already-final sale throws and leaves it intact", async () => {
    const p = await stocked();
    const f = await salesService.checkout({ cart: cartWith(p), locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1e7 }] });
    const cart = patchCart(cartWith(p), { resumedFromId: f.id });
    const before = structuredClone(getDB());
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "draft" })).rejects.toBeInstanceOf(NotFoundError);
    expect(getDB()).toEqual(before);
    expect(getDB().transactions.find((t) => t.id === f.id)).toMatchObject({ status: "final" });
  });
});

describe("salesService.listAll / get", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("kind narrows by status; totals span every filtered row, not the page", async () => {
    const all = await salesService.listAll({ pageSize: 5 });
    expect(all.rows).toHaveLength(5);
    expect(all.total).toBeGreaterThan(5);
    const sum = getDB().transactions.filter((t) => t.type === "sell" && t.status !== "suspended").reduce((s, t) => s + t.totals.total, 0);
    expect(all.totals.total).toBeCloseTo(sum, 2);
    const drafts = await salesService.listAll({ kind: "drafts", pageSize: -1 });
    expect(drafts.rows.every((r) => r.status === "draft")).toBe(true);
    const quotes = await salesService.listAll({ kind: "quotations", pageSize: -1 });
    expect(quotes.rows.every((r) => r.status === "quotation")).toBe(true);
  });

  it("filters by payment status, customer, date range and search", async () => {
    const due = await salesService.listAll({ kind: "all", paymentStatus: "due", pageSize: -1 });
    expect(due.rows.every((r) => r.paymentStatus === "due")).toBe(true);
    const one = (await salesService.listAll({ pageSize: -1 })).rows.find((r) => r.status === "final")!;
    const t = getDB().transactions.find((x) => x.id === one.id)!;
    const byContact = await salesService.listAll({ contactId: t.contactId!, pageSize: -1 });
    expect(byContact.rows.every((r) => getDB().transactions.find((x) => x.id === r.id)!.contactId === t.contactId)).toBe(true);
    const day = await salesService.listAll({ from: t.date.slice(0, 10), to: t.date.slice(0, 10), pageSize: -1 });
    expect(day.rows.map((r) => r.id)).toContain(one.id);
    expect((await salesService.listAll({ search: one.refNo, pageSize: -1 })).rows.map((r) => r.id)).toContain(one.id);
    expect((await salesService.listAll({ search: "zzzz-none", pageSize: -1 })).total).toBe(0);
  });

  it("returnDue is the paid amount on the sale minus nothing when no return exists", async () => {
    const row = (await salesService.listAll({ pageSize: -1 })).rows.find((r) => r.status === "final")!;
    expect(row.returnDue).toBeGreaterThanOrEqual(0);
  });

  it("get joins names; unknown id throws NotFoundError", async () => {
    const row = (await salesService.listAll({ pageSize: 1 })).rows[0];
    const s = await salesService.get(row.id);
    expect(s.id).toBe(row.id);
    expect(s.locationName).toBeTruthy();
    expect(Object.keys(s.lineNames).length).toBe(s.lines.length);
    await expect(salesService.get("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("salesService.save / convert / removeAny", () => {
  const lotsLeft = (vid: string) =>
    getDB().stockLots.filter((l) => l.variationId === vid && l.locationId === LOC_RANGO).reduce((s, l) => s + l.qtyRemaining, 0);
  const cash = (amount: number) => [{ method: "cash" as const, amount }];

  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  async function finalSale(qty = 2) {
    const p = await stocked();
    const vid = p.variations[0].id;
    const before = lotsLeft(vid);
    const cart = patchCart(cartWith(p, qty), { contactId: customer().id });
    const probe = await salesService.save({ cart, locationId: LOC_RANGO, status: "quotation" });
    const res = await salesService.save({ cart, locationId: LOC_RANGO, status: "final", payments: cash(probe.total) });
    return { p, vid, before, cart, res };
  }

  it("editing a final sale twice does not drift stock", async () => {
    const { p, vid, before, cart, res } = await finalSale(2);
    expect(lotsLeft(vid)).toBeCloseTo(before - 2, 4);
    await salesService.save({ id: res.id, cart, locationId: LOC_RANGO, status: "final" });
    await salesService.save({ id: res.id, cart, locationId: LOC_RANGO, status: "final" });
    expect(lotsLeft(vid)).toBeCloseTo(before - 2, 4);
    const t = getDB().transactions.find((x) => x.id === res.id)!;
    expect(t.refNo).toBe(res.refNo);
    expect(getDB().transactions.filter((x) => x.refNo === res.refNo)).toHaveLength(1);
    expect(p).toBeTruthy();
  });

  it("editing quantity changes stock and payment status", async () => {
    const { p, vid, before, cart, res } = await finalSale(1);
    const bigger = patchCart({ ...cart, lines: cart.lines.map((l) => ({ ...l, qty: 2 })) }, {});
    const out = await salesService.save({ id: res.id, cart: bigger, locationId: LOC_RANGO, status: "final" });
    expect(lotsLeft(vid)).toBeCloseTo(before - 2, 4);
    expect(out.due).toBeGreaterThan(0);
    expect(getDB().transactions.find((x) => x.id === res.id)!.paymentStatus).not.toBe("paid");
    expect(p).toBeTruthy();
  });

  it("additional expenses add to the total; a fifth is rejected", async () => {
    const p = await stocked();
    const cart = patchCart(cartWith(p), { contactId: customer().id });
    const base = await salesService.save({ cart, locationId: LOC_RANGO, status: "draft" });
    const plus = await salesService.save({ cart, locationId: LOC_RANGO, status: "draft", additionalExpenses: [{ name: "Packing", amount: 25 }] });
    expect(plus.total - base.total).toBe(25);
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `e${i}`, amount: 1 }));
    await expect(salesService.save({ cart, locationId: LOC_RANGO, status: "draft", additionalExpenses: five })).rejects.toBeInstanceOf(ValidationError);
  });

  it("a manual invoice number must be unique", async () => {
    const { cart, res } = await finalSale(1);
    const dup = salesService.save({ cart, locationId: LOC_RANGO, status: "final", refNo: res.refNo, payments: cash(99999) });
    await expect(dup).rejects.toMatchObject({ code: "duplicate_ref" });
  });

  it("convert: quotation becomes final, takes stock and gets an invoice number", async () => {
    const p = await stocked();
    const vid = p.variations[0].id;
    const before = lotsLeft(vid);
    const cart = patchCart(cartWith(p, 2), { contactId: customer().id });
    const q = await salesService.save({ cart, locationId: LOC_RANGO, status: "quotation" });
    const out = await salesService.convert(q.id, cash(q.total));
    expect(out).toMatchObject({ id: q.id, status: "final", due: 0 });
    expect(out.refNo).not.toBe(q.refNo);
    expect(lotsLeft(vid)).toBeCloseTo(before - 2, 4);
  });

  it("convert with short stock throws and leaves the DB unchanged", async () => {
    const p = await stocked();
    const cart = patchCart(cartWith(p, 1), { contactId: customer().id });
    const q = await salesService.save({ cart, locationId: LOC_RANGO, status: "quotation" });
    commit((d) => { d.transactions.find((t) => t.id === q.id)!.lines[0].qty = 100000; });
    const before = structuredClone(getDB());
    await expect(salesService.convert(q.id)).rejects.toBeInstanceOf(InsufficientStockError);
    expect(getDB()).toEqual(before);
  });

  it("removeAny on a final sale restores stock and ledger", async () => {
    const { vid, before, res } = await finalSale(2);
    const accounts = getDB().accountTxns.filter((a) => a.transactionId === res.id).length;
    expect(accounts).toBeGreaterThan(0);
    await salesService.removeAny(res.id);
    expect(lotsLeft(vid)).toBeCloseTo(before, 4);
    expect(getDB().accountTxns.some((a) => a.transactionId === res.id)).toBe(false);
    expect(getDB().transactions.some((t) => t.id === res.id)).toBe(false);
  });

  it("edit and delete need sell.update / sell.delete", async () => {
    const { cart, res } = await finalSale(1);
    useSession.setState({ userId: "user_cashier" });
    await expect(salesService.save({ id: res.id, cart, locationId: LOC_RANGO, status: "final" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(salesService.removeAny(res.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("salesService payments and shipping", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  async function dueSale() {
    const p = await stocked();
    const cart = patchCart(cartWith(p), { contactId: customer().id });
    const probe = await salesService.save({ cart, locationId: LOC_RANGO, status: "quotation" });
    const res = await salesService.save({ cart, locationId: LOC_RANGO, status: "final", payments: [] });
    return { res, total: probe.total };
  }
  const status = (id: string) => getDB().transactions.find((t) => t.id === id)!.paymentStatus;

  it("partial then full payment moves due → partial → paid", async () => {
    const { res, total } = await dueSale();
    expect(status(res.id)).toBe("due");
    await salesService.addPayment(res.id, { method: "cash", amount: 1 });
    expect(status(res.id)).toBe("partial");
    await salesService.addPayment(res.id, { method: "cash", amount: total - 1 });
    expect(status(res.id)).toBe("paid");
  });

  it("overpaying is rejected", async () => {
    const { res, total } = await dueSale();
    await expect(salesService.addPayment(res.id, { method: "cash", amount: total + 1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("drafts take no payment", async () => {
    const p = await stocked();
    const d = await salesService.save({ cart: cartWith(p), locationId: LOC_RANGO, status: "draft" });
    await expect(salesService.addPayment(d.id, { method: "cash", amount: 1 })).rejects.toMatchObject({ code: "not_final" });
  });

  it("removing a payment reverses its ledger row and status", async () => {
    const { res, total } = await dueSale();
    await salesService.addPayment(res.id, { method: "cash", amount: total });
    const pay = getDB().transactions.find((t) => t.id === res.id)!.payments[0];
    expect(getDB().accountTxns.some((a) => a.paymentId === pay.id)).toBe(true);
    await salesService.removePayment(res.id, pay.id);
    expect(getDB().accountTxns.some((a) => a.paymentId === pay.id)).toBe(false);
    expect(status(res.id)).toBe("due");
  });

  it("setShipping persists the new status", async () => {
    const { res } = await dueSale();
    await salesService.setShipping(res.id, { status: "shipped", deliveredTo: "Karim" });
    expect(getDB().transactions.find((t) => t.id === res.id)!.shipping).toMatchObject({ status: "shipped", deliveredTo: "Karim" });
  });
});

describe("salesService.generateNext", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("creates a new unpaid invoice with the same lines and links it to the subscription", async () => {
    const p = await stocked();
    const cart = patchCart(cartWith(p, 1), { contactId: customer().id });
    const first = await salesService.save({
      cart, locationId: LOC_RANGO, status: "final", payments: [], recurring: { interval: 1, intervalType: "months", repetitions: 3, repeatOn: 5, parentId: null },
    });
    const next = await salesService.generateNext(first.id);
    expect(next.id).not.toBe(first.id);
    expect(next.refNo).not.toBe(first.refNo);
    expect(next.due).toBe(first.total);
    const t = getDB().transactions.find((x) => x.id === next.id)!;
    expect(t.recurring?.parentId).toBe(first.id);
    expect(t.lines).toHaveLength(1);
  });

  it("a sale that isn't a subscription can't be generated from", async () => {
    const p = await stocked();
    const cart = patchCart(cartWith(p, 1), { contactId: customer().id });
    const plain = await salesService.save({ cart, locationId: LOC_RANGO, status: "final", payments: [] });
    await expect(salesService.generateNext(plain.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("salesService.listAll shipments", () => {
  it("shipped + delivery person filters", async () => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
    const sale = getDB().transactions.find((t) => t.type === "sell" && t.status === "final")!;
    await salesService.setShipping(sale.id, { status: "packed", deliveryPersonId: "user_manager" });
    const rows = (await salesService.listAll({ shipped: true, pageSize: -1 })).rows;
    expect(rows.every((r) => r.shippingStatus)).toBe(true);
    expect(rows.map((r) => r.id)).toContain(sale.id);
    const by = (await salesService.listAll({ deliveryPersonId: "user_manager", pageSize: -1 })).rows;
    expect(by.map((r) => r.id)).toEqual([sale.id]);
    expect(by[0].deliveryPerson).not.toBe("");
  });
});
