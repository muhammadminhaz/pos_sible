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
});
