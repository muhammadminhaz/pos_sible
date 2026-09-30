import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart, patchCart } from "@/lib/pos/cart";
import { posService, toCartItem } from "./pos";
import { returnsService } from "./returns";
import { salesService } from "./sales";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const lotsLeft = (vid: string) =>
  getDB().stockLots.filter((l) => l.variationId === vid && l.locationId === LOC_RANGO).reduce((s, l) => s + l.qtyRemaining, 0);

async function sold(qty = 3, pay = true) {
  const rows = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows;
  const p = rows.find((x) => x.type !== "combo" && x.manageStock && !x.enableSerial && x.variations[0].stock >= 5)!;
  const customer = getDB().contacts.find((c) => c.type === "customer" && !c.isDefault && c.creditLimit == null)!;
  const cart = patchCart(addItem(emptyCart(), toCartItem(p, p.variations[0], qty)), { contactId: customer.id });
  const probe = await salesService.save({ cart, locationId: LOC_RANGO, status: "quotation" });
  const res = await salesService.save({ cart, locationId: LOC_RANGO, status: "final", payments: pay ? [{ method: "cash", amount: probe.total }] : [] });
  return { vid: p.variations[0].id, res, sale: getDB().transactions.find((t) => t.id === res.id)! };
}

describe("returnsService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("partial return restocks, marks the parent line and refunds a paid sale", async () => {
    const { vid, sale } = await sold(3);
    const before = lotsLeft(vid);
    const out = await returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 1 }] });
    expect(lotsLeft(vid)).toBeCloseTo(before + 1, 4);
    const parent = getDB().transactions.find((t) => t.id === sale.id)!;
    expect(parent.lines[0].returnedQty).toBe(1);
    const ret = getDB().transactions.find((t) => t.id === out.id)!;
    expect(ret).toMatchObject({ type: "sell_return", parentId: sale.id, paymentStatus: "paid" });
    expect(ret.payments[0].amount).toBeCloseTo(out.total, 2);
    expect(getDB().accountTxns.some((a) => a.transactionId === ret.id && a.kind === "debit")).toBe(true);
  });

  it("parentLines reports sold and already returned qty", async () => {
    const { sale } = await sold(3);
    await returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 2 }] });
    const lines = await returnsService.parentLines(sale.id);
    expect(lines[0]).toMatchObject({ soldQty: 3, returnedQty: 2 });
  });

  it("returning more than was sold (across returns) is rejected", async () => {
    const { sale } = await sold(3);
    await returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 2 }] });
    await expect(returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 2 }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("empty or zero-qty returns are rejected", async () => {
    const { sale } = await sold(1);
    await expect(returnsService.create({ parentId: sale.id, lines: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 0 }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("an unpaid sale is credited, not refunded", async () => {
    const { sale } = await sold(2, false);
    const out = await returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 1 }] });
    const ret = getDB().transactions.find((t) => t.id === out.id)!;
    expect(ret.payments).toHaveLength(0);
  });

  it("list filters by customer and shows the parent invoice", async () => {
    const { sale } = await sold(2);
    await returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 1 }] });
    const rows = (await returnsService.list({ contactId: sale.contactId!, pageSize: -1 })).rows;
    expect(rows[0]).toMatchObject({ parentId: sale.id, parentRef: sale.refNo });
    expect((await returnsService.list({ contactId: "nobody", pageSize: -1 })).total).toBe(0);
  });

  it("remove undoes stock, returnedQty and the ledger", async () => {
    const { vid, sale } = await sold(3);
    const before = lotsLeft(vid);
    const out = await returnsService.create({ parentId: sale.id, lines: [{ lineId: sale.lines[0].id, qty: 2 }] });
    await returnsService.remove(out.id);
    expect(lotsLeft(vid)).toBeCloseTo(before, 4);
    expect(getDB().transactions.find((t) => t.id === sale.id)!.lines[0].returnedQty).toBe(0);
    expect(getDB().accountTxns.some((a) => a.transactionId === out.id)).toBe(false);
    await expect(returnsService.remove(out.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
