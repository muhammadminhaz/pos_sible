import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart, patchCart, setContact } from "@/lib/pos/cart";
import { contactsService } from "./contacts";
import { posService, toCartItem } from "./pos";
import { registersService } from "./registers";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

async function cartWithItem(contactId: string, points: number) {
  const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock && x.variations[0].stock > 5)!;
  let cart = addItem(emptyCart(), toCartItem(p, p.variations[0], 1), "new_row");
  cart = setContact(cart, contactId);
  return patchCart(cart, { pointsRedeemed: points });
}

describe("POS follow-ups", () => {
  beforeEach(async () => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
    commit((d) => {
      Object.assign(d.settings.rewards, { enabled: true, minOrderTotalToRedeem: 0, minRedeemPoint: 1, maxRedeemPoint: null, redeemAmountPerPoint: 0.01 });
      for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    });
    await registersService.open(LOC_RANGO, 0);
  });

  it("points can't be spent twice across a customer's suspended sales", async () => {
    const customer = getDB().contacts.find((c) => c.type === "customer" && !c.isDefault)!;
    commit((d) => void (d.contacts.find((c) => c.id === customer.id)!.points = 400));
    await salesService.checkout({ cart: await cartWithItem(customer.id, 300), locationId: LOC_RANGO, status: "suspended", payments: [] });
    // 100 left unreserved: 200 is refused, 100 is accepted.
    await expect(salesService.checkout({ cart: await cartWithItem(customer.id, 200), locationId: LOC_RANGO, status: "suspended", payments: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(salesService.checkout({ cart: await cartWithItem(customer.id, 100), locationId: LOC_RANGO, status: "suspended", payments: [] })).resolves.toBeTruthy();
  });

  it("a points redemption below the minimum is rejected at checkout", async () => {
    const customer = getDB().contacts.find((c) => c.type === "customer" && !c.isDefault)!;
    commit((d) => { d.contacts.find((c) => c.id === customer.id)!.points = 400; d.settings.rewards.minRedeemPoint = 50; });
    await expect(salesService.checkout({ cart: await cartWithItem(customer.id, 10), locationId: LOC_RANGO, status: "suspended", payments: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("POS lists only show POS-channel sales", async () => {
    await salesService.checkout({ cart: await cartWithItem(getDB().contacts.find((c) => c.isDefault)!.id, 0), locationId: LOC_RANGO, status: "suspended", payments: [] });
    const sale = (await salesService.list({ locationId: LOC_RANGO, status: "suspended", channel: "pos" }))[0];
    expect(sale).toBeTruthy();
    commit((d) => void (d.transactions.find((t) => t.id === sale.id)!.channel = "web"));
    expect((await salesService.list({ locationId: LOC_RANGO, status: "suspended", channel: "pos" })).map((x) => x.id)).not.toContain(sale.id);
    expect((await salesService.list({ locationId: LOC_RANGO, status: "suspended" })).map((x) => x.id)).toContain(sale.id);
  });

  it("adding a customer with an existing mobile reports a duplicate", async () => {
    const mobile = getDB().contacts.find((c) => c.type === "customer" && !c.isDefault)!.mobile;
    const err = await contactsService.createCustomer({ name: "Someone", mobile }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).fields.mobile).toBe("duplicate");
  });

  it("merging a line refreshes its stock limit", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock && x.variations[0].stock > 5)!;
    const item = toCartItem(p, p.variations[0], 1);
    const merged = addItem(addItem(emptyCart(), { ...item, maxQty: 2 }), { ...item, maxQty: 9 });
    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0].maxQty).toBe(9);
  });

  it("minimum selling price refuses a sale below the product's price list", async () => {
    commit((d) => void (d.settings.sale.minSellingPrice = true));
    const cart = await cartWithItem(getDB().contacts.find((c) => c.isDefault)!.id, 0);
    const cheap = { ...cart, lines: cart.lines.map((l) => ({ ...l, unitPrice: 1 })) };
    await expect(salesService.checkout({ cart: cheap, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1 }] })).rejects.toMatchObject({ code: "below_min_price" });
    commit((d) => void (d.settings.sale.minSellingPrice = false));
    await expect(salesService.checkout({ cart: cheap, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 1 }] })).resolves.toBeTruthy();
  });

  it("stop-selling blocks expired lots but not the rest", async () => {
    const cart = await cartWithItem(getDB().contacts.find((c) => c.isDefault)!.id, 0);
    const vid = cart.lines[0].variationId;
    commit((d) => {
      Object.assign(d.settings.product, { enableExpiry: true, onExpiry: "stop_selling", stopSellingBeforeDays: 0 });
      for (const l of d.stockLots) if (l.variationId === vid && l.locationId === LOC_RANGO) l.expDate = "2020-01-01";
    });
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 99999 }] })).rejects.toMatchObject({ name: "InsufficientStockError" });
    commit((d) => void (d.settings.product.onExpiry = "keep_selling"));
    await expect(salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 99999 }] })).resolves.toBeTruthy();
  });
});

describe("sales orders", () => {
  beforeEach(async () => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
    commit((d) => {
      for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    });
    await registersService.open(LOC_RANGO, 0);
  });

  it("turns an open order into a sale cart for what is still owed, and only deletes untouched orders", async () => {
    const { ordersService } = await import("./orders");
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock && x.variations[0].stock > 10 && !x.enableSerial)!;
    const v = p.variations[0];
    const customer = getDB().contacts.find((c) => c.type === "customer" && !c.isDefault)!;
    const line = { productId: p.id, variationId: v.id, unitId: p.unitId, qty: 5, unitPrice: v.unitPrice };
    const untouched = await ordersService.create({ locationId: LOC_RANGO, contactId: customer.id, lines: [line] });
    const used = await ordersService.create({ locationId: LOC_RANGO, contactId: customer.id, lines: [line] });

    expect((await salesService.fromOrder(used.id)).cart.lines[0].qty).toBe(5);
    const cart = (await salesService.fromOrder(used.id)).cart;
    await salesService.save({ cart: { ...cart, lines: cart.lines.map((l) => ({ ...l, qty: 2 })) }, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 99999 }], salesOrderIds: [used.id] });
    expect((await salesService.fromOrder(used.id)).cart.lines[0].qty).toBe(3);
    await expect(ordersService.remove(used.id)).rejects.toMatchObject({ code: "order_in_use" });

    await expect(ordersService.remove(untouched.id)).resolves.toBeUndefined();
    await expect(salesService.fromOrder(untouched.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
