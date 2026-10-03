import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { available } from "@/lib/domain/stock";
import { adjustmentsService } from "./adjustments";
import { purchaseReturnsService } from "./purchaseReturns";
import { purchasesService } from "./purchases";
import { transfersService } from "./transfers";

const seed = createSeed({ seed: 42, today: "2026-09-27" });
const stock = (vid: string, loc: string) => available(getDB().stockLots, vid, loc);

/** A single-unit, stock-managed product sold at both locations, with stock at Rango. */
function shared() {
  const d = getDB();
  const p = d.products.find((x) => x.manageStock && x.type === "single" && x.locationIds.length > 1 && !x.enableSerial && d.variations.some((v) => v.productId === x.id && stock(v.id, LOC_RANGO) >= 10))!;
  const v = d.variations.find((x) => x.productId === p.id)!;
  return { p, v };
}

describe("purchase returns", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });
  async function bought() {
    const { p, v } = shared();
    const supplier = getDB().contacts.find((c) => c.type === "supplier")!;
    const { id } = await purchasesService.save({
      locationId: LOC_RANGO, contactId: supplier.id, date: "2026-09-27T10:00:00", status: "received", lines: [{ productId: p.id, variationId: v.id, qty: 10, unitPrice: 100, discount: null, taxId: null }],
      discount: null, orderTaxId: null, shipping: { charges: 0, details: "" }, additionalExpenses: [], exchangeRate: 1, payTerm: null, notes: "", documents: [], payments: [{ method: "cash", amount: 1000 }],
    });
    const line = getDB().transactions.find((t) => t.id === id)!.lines[0];
    return { id, v, line };
  }

  it("takes returned stock out of the purchase's lot and refunds what was paid", async () => {
    const { id, v, line } = await bought();
    const before = stock(v.id, LOC_RANGO);
    const r = await purchaseReturnsService.create({ parentId: id, lines: [{ lineId: line.id, qty: 4 }] });
    expect(stock(v.id, LOC_RANGO)).toBe(before - 4);
    expect(r.total).toBe(400);
    const ret = getDB().transactions.find((t) => t.id === r.id)!;
    expect(ret.paymentStatus).toBe("paid");
    expect(getDB().transactions.find((t) => t.id === id)!.lines[0].returnedQty).toBe(4);
  });

  it("can't return more than was bought or more than is still in the lot", async () => {
    const { id, line } = await bought();
    await expect(purchaseReturnsService.create({ parentId: id, lines: [{ lineId: line.id, qty: 11 }] })).rejects.toMatchObject({ fields: { lines: "over_return" } });
    getDB().stockLots.find((l) => l.sourceTxnId === id)!.qtyRemaining = 2;
    await expect(purchaseReturnsService.create({ parentId: id, lines: [{ lineId: line.id, qty: 3 }] })).rejects.toMatchObject({ fields: { lines: "over_stock" } });
    await expect(purchaseReturnsService.create({ parentId: id, lines: [{ lineId: line.id, qty: 0 }] })).rejects.toMatchObject({ fields: { lines: "required" } });
  });

  it("deleting a return puts the stock back; a purchase with returns can't be edited or deleted", async () => {
    const { id, v, line } = await bought();
    const before = stock(v.id, LOC_RANGO);
    const r = await purchaseReturnsService.create({ parentId: id, lines: [{ lineId: line.id, qty: 4 }] });
    await expect(purchasesService.remove(id)).rejects.toMatchObject({ code: "has_returns" });
    await expect(purchasesService.setStatus(id, "pending")).rejects.toMatchObject({ code: "has_returns" });
    await purchaseReturnsService.remove(r.id);
    expect(stock(v.id, LOC_RANGO)).toBe(before);
    expect(getDB().transactions.find((t) => t.id === id)!.lines[0].returnedQty).toBe(0);
  });

  it("parentLines reports how much is still in stock", async () => {
    const { id } = await bought();
    const rows = await purchaseReturnsService.parentLines(id);
    expect(rows[0]).toMatchObject({ boughtQty: 10, returnedQty: 0, inStock: 10 });
  });
});

describe("stock transfers", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });
  const make = (status: "pending" | "in_transit" | "completed", qty = 5) => {
    const { p, v } = shared();
    return { p, v, input: { fromLocationId: LOC_RANGO, toLocationId: LOC_NIPUN, date: "2026-09-27T10:00:00", status, lines: [{ productId: p.id, variationId: v.id, qty }], shippingCharges: 50, notes: "" } };
  };

  it("stock leaves the source in transit and arrives on completion", async () => {
    const { v, input } = make("pending");
    const src = stock(v.id, LOC_RANGO);
    const dst = stock(v.id, LOC_NIPUN);
    const { id } = await transfersService.create(input);
    expect([stock(v.id, LOC_RANGO), stock(v.id, LOC_NIPUN)]).toEqual([src, dst]);
    await transfersService.updateStatus(id, "in_transit");
    expect([stock(v.id, LOC_RANGO), stock(v.id, LOC_NIPUN)]).toEqual([src - 5, dst]);
    await transfersService.updateStatus(id, "completed");
    expect([stock(v.id, LOC_RANGO), stock(v.id, LOC_NIPUN)]).toEqual([src - 5, dst + 5]);
  });

  it("completing straight from pending does both steps, and destination lots keep the cost", async () => {
    const { v, input } = make("pending");
    const { id } = await transfersService.create(input);
    await transfersService.updateStatus(id, "completed");
    const t = getDB().transactions.find((x) => x.id === id)!;
    const dest = getDB().stockLots.filter((l) => l.sourceTxnId === id);
    expect(dest.reduce((s, l) => s + l.qtyIn, 0)).toBe(5);
    expect(dest.map((l) => l.unitCost).sort()).toEqual(t.lines[0].allocations.map((a) => a.unitCost).sort());
    expect(dest.every((l) => l.locationId === LOC_NIPUN && l.variationId === v.id)).toBe(true);
  });

  it("rejects the same source and destination, backwards moves and moving more than is there", async () => {
    const { input, v } = make("pending");
    await expect(transfersService.create({ ...input, toLocationId: LOC_RANGO })).rejects.toMatchObject({ fields: { toLocationId: "same" } });
    const { id } = await transfersService.create(input);
    await transfersService.updateStatus(id, "in_transit");
    await expect(transfersService.updateStatus(id, "pending")).rejects.toMatchObject({ code: "status_backwards" });
    await expect(transfersService.updateStatus(id, "in_transit")).rejects.toMatchObject({ code: "status_backwards" });
    await expect(transfersService.create({ ...input, status: "in_transit", lines: [{ ...input.lines[0], qty: stock(v.id, LOC_RANGO) + 1 }] })).rejects.toMatchObject({ name: "InsufficientStockError" });
  });

  it("cancelling an in-transit transfer returns the stock; cancelling a completed one takes it back from the destination", async () => {
    const { v, input } = make("in_transit");
    const src = stock(v.id, LOC_RANGO);
    const dst = stock(v.id, LOC_NIPUN);
    const a = await transfersService.create(input);
    await transfersService.remove(a.id);
    expect([stock(v.id, LOC_RANGO), stock(v.id, LOC_NIPUN)]).toEqual([src, dst]);
    const b = await transfersService.create({ ...input, status: "completed" });
    await transfersService.remove(b.id);
    expect([stock(v.id, LOC_RANGO), stock(v.id, LOC_NIPUN)]).toEqual([src, dst]);
  });

  it("can't cancel once the arrived stock has been used", async () => {
    const { v, input } = make("completed");
    const { id } = await transfersService.create(input);
    getDB().stockLots.find((l) => l.sourceTxnId === id)!.qtyRemaining -= 1;
    await expect(transfersService.remove(id)).rejects.toMatchObject({ code: "stock_used" });
    expect(stock(v.id, LOC_NIPUN)).toBeGreaterThan(0);
  });

  it("a seeded in-transit transfer has already left the source", async () => {
    const t = getDB().transactions.find((x) => x.type === "stock_transfer" && x.status === "in_transit");
    if (t) expect(t.lines.every((l) => l.allocations.length > 0)).toBe(true);
  });

  it("totals include shipping and the product reaches the destination's product list", async () => {
    const { p, input } = make("completed");
    const { id } = await transfersService.create(input);
    const t = getDB().transactions.find((x) => x.id === id)!;
    expect(t.totals.shipping).toBe(50);
    expect(getDB().products.find((x) => x.id === p.id)!.locationIds).toContain(LOC_NIPUN);
  });
});

describe("stock adjustments", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });
  const make = (qty: number, over: object = {}) => {
    const { p, v } = shared();
    return { v, input: { locationId: LOC_RANGO, date: "2026-09-27T10:00:00", type: "normal" as const, amountRecovered: 0, reason: "Damaged", lines: [{ productId: p.id, variationId: v.id, qty }], ...over } };
  };

  it("reduces stock and records the cost taken from the lots", async () => {
    const { v, input } = make(3);
    const before = stock(v.id, LOC_RANGO);
    const r = await adjustmentsService.create(input);
    expect(stock(v.id, LOC_RANGO)).toBe(before - 3);
    expect(r.total).toBeGreaterThan(0);
  });

  it("refuses to remove more than is available unless overselling is allowed", async () => {
    const { v, input } = make(0);
    input.lines[0].qty = stock(v.id, LOC_RANGO) + 1;
    await expect(adjustmentsService.create(input)).rejects.toMatchObject({ name: "InsufficientStockError" });
    getDB().settings.sale.allowOverselling = true;
    await expect(adjustmentsService.create(input)).resolves.toBeTruthy();
  });

  it("records the recovered amount for abnormal adjustments only, within the total", async () => {
    const { input } = make(2, { type: "abnormal", amountRecovered: 10 });
    const r = await adjustmentsService.create(input);
    expect(getDB().transactions.find((t) => t.id === r.id)).toMatchObject({ adjustmentType: "abnormal", amountRecovered: 10 });
    await expect(adjustmentsService.create({ ...input, amountRecovered: r.total + 1 })).rejects.toMatchObject({ fields: { amountRecovered: "invalid" } });
    const n = make(1, { type: "normal", amountRecovered: 99 });
    const out = await adjustmentsService.create(n.input);
    expect(getDB().transactions.find((t) => t.id === out.id)!.amountRecovered).toBe(0);
  });

  it("deleting puts the stock back", async () => {
    const { v, input } = make(4);
    const before = stock(v.id, LOC_RANGO);
    const { id } = await adjustmentsService.create(input);
    await adjustmentsService.remove(id);
    expect(stock(v.id, LOC_RANGO)).toBe(before);
  });

  it("rejects an empty list and a non-positive quantity; needs the permission", async () => {
    const { input } = make(1);
    await expect(adjustmentsService.create({ ...input, lines: [] })).rejects.toMatchObject({ fields: { lines: "required" } });
    await expect(adjustmentsService.create({ ...input, lines: [{ ...input.lines[0], qty: 0 }] })).rejects.toMatchObject({ fields: { lines: "qty" } });
    useSession.setState({ userId: "user_cashier" });
    await expect(adjustmentsService.create(input)).rejects.toMatchObject({ code: "forbidden" });
  });
});
