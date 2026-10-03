import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart, patchCart, setQty } from "@/lib/pos/cart";
import { ordersService } from "./orders";
import { posService, toCartItem } from "./pos";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

async function setup(orderQty = 4) {
  const rows = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows;
  const p = rows.find((x) => x.type !== "combo" && x.manageStock && !x.enableSerial && x.variations[0].stock >= 6)!;
  const v = p.variations[0];
  const customer = getDB().contacts.find((c) => c.type === "customer" && !c.isDefault && c.creditLimit == null)!;
  const order = await ordersService.create({
    locationId: LOC_RANGO, contactId: customer.id, lines: [{ productId: p.id, variationId: v.id, unitId: p.unitId, qty: orderQty, unitPrice: v.unitPrice }],
  });
  const sell = async (qty: number) => {
    let cart = addItem(emptyCart(), toCartItem(p, v, qty));
    cart = patchCart(setQty(cart, cart.lines[0].key, qty), { contactId: customer.id });
    return salesService.save({ cart, locationId: LOC_RANGO, status: "final", payments: [], salesOrderIds: [order.id] });
  };
  const status = () => getDB().transactions.find((t) => t.id === order.id)!.status;
  return { order, sell, status, customer };
}

describe("ordersService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("a new order is ordered with its full qty remaining", async () => {
    const { order } = await setup(4);
    const row = (await ordersService.list({ pageSize: -1 })).rows.find((r) => r.id === order.id)!;
    expect(row).toMatchObject({ status: "ordered", remainingQty: 4 });
  });

  it("linking half makes it partial; linking the rest completes it; deleting reverts", async () => {
    const { order, sell, status } = await setup(4);
    const a = await sell(2);
    expect(status()).toBe("partial");
    expect((await ordersService.list({ pageSize: -1 })).rows.find((r) => r.id === order.id)!.remainingQty).toBe(2);
    await sell(2);
    expect(status()).toBe("completed");
    await salesService.removeAny(a.id);
    expect(status()).toBe("partial");
  });

  it("openFor lists only orders with qty left", async () => {
    const { order, sell, customer } = await setup(2);
    expect((await ordersService.openFor(customer.id)).map((r) => r.id)).toContain(order.id);
    await sell(2);
    expect((await ordersService.openFor(customer.id)).map((r) => r.id)).not.toContain(order.id);
  });

  it("an order needs at least one positive-qty line", async () => {
    const { customer } = await setup(1);
    await expect(ordersService.create({ locationId: LOC_RANGO, contactId: customer.id, lines: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("filters by status", async () => {
    const { order } = await setup(1);
    const rows = (await ordersService.list({ status: "ordered", pageSize: -1 })).rows;
    expect(rows.every((r) => r.status === "ordered")).toBe(true);
    expect(rows.map((r) => r.id)).toContain(order.id);
  });
});
