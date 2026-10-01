import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { available } from "@/lib/domain/stock";
import { addItem, emptyCart } from "@/lib/pos/cart";
import { posService, toCartItem } from "./pos";
import { salesService } from "./sales";
import { productsService, type ProductFormData } from "./products";

const seed = createSeed({ seed: 42, today: "2026-09-27" });

describe("productsService", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("finds a product by name, best match first", async () => {
    const name = getDB().products[0].name;
    const res = await productsService.list({ search: name });
    expect(res.rows[0].name).toBe(name);
  });

  it("paginates with a correct total", async () => {
    const res = await productsService.list({ pageSize: 10 });
    expect(res.rows).toHaveLength(10);
    expect(res.total).toBe(getDB().products.length);
  });

  it("deactivated products show under the inactive filter", async () => {
    const id = getDB().products[3].id;
    await productsService.setActive([id], false);
    const res = await productsService.list({ active: "inactive", pageSize: -1 });
    expect(res.rows.map((r) => r.id)).toContain(id);
    const active = await productsService.list({ active: "active", pageSize: -1 });
    expect(active.rows.map((r) => r.id)).not.toContain(id);
  });

  it("stock equals the sum of the product's lots", async () => {
    const p = getDB().products[0];
    const expected = getDB().stockLots.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qtyRemaining, 0);
    const row = await productsService.get(p.id);
    expect(row.stock).toBeCloseTo(expected, 4);
  });

  it("adds and removes locations in bulk", async () => {
    const p = getDB().products.find((x) => x.locationIds.length === 1)!;
    const other = getDB().locations.find((l) => !p.locationIds.includes(l.id))!.id;
    await productsService.setLocations([p.id], [other], "add");
    expect((await productsService.get(p.id)).locationIds).toContain(other);
    await productsService.setLocations([p.id], [other], "remove");
    expect((await productsService.get(p.id)).locationIds).not.toContain(other);
  });

  describe("writing products", () => {
    const form = (over: Partial<ProductFormData> = {}): ProductFormData => {
      const p = getDB().products[0];
      return {
        name: "Test Item", sku: "", barcodeType: "C128", unitId: p.unitId, subUnitIds: [], secondaryUnitId: null, brandId: null, categoryId: null,
        subCategoryId: null, locationIds: p.locationIds, manageStock: true, alertQty: null, description: "", image: null, brochure: null,
        expiryPeriod: null, expiryPeriodType: null, enableSerial: false, notForSale: false, weight: "", prepTimeMinutes: null, taxId: null,
        taxType: "exclusive", type: "single", variationTemplateId: null, warrantyId: null, rack: "", row: "", position: "", customFields: [],
        active: true,
        variations: [{ name: "DUMMY", sku: "", purchasePriceExc: 100, purchasePriceInc: 100, margin: 20, sellPriceExc: 120, sellPriceInc: 120, groupPrices: {}, image: null, comboItems: [] }],
        ...over,
      };
    };
    const v = (name: string, sku = "") => ({ ...form().variations[0], name, sku });

    it("gives a blank SKU the next free number, with the settings prefix", async () => {
      getDB().settings.product.skuPrefix = "SK-";
      const { id } = await productsService.create(form());
      const f = await productsService.getForm(id);
      expect(f.sku).toMatch(/^SK-\d{4}$/);
      expect(f.variations[0].sku).toBe(f.sku);
    });

    it("never reuses the SKU of a deleted product", async () => {
      const a = await productsService.create(form());
      const skuA = (await productsService.getForm(a.id)).sku;
      await productsService.remove([a.id]);
      const b = await productsService.create(form());
      expect((await productsService.getForm(b.id)).sku).not.toBe(skuA);
    });

    it("rejects a SKU used by another product or any variation", async () => {
      const taken = getDB().products[0].sku;
      await expect(productsService.create(form({ sku: taken }))).rejects.toMatchObject({ fields: { sku: "duplicate" } });
      const vsku = getDB().variations.find((x) => x.sku.includes("-"))!.sku;
      await expect(productsService.create(form({ sku: vsku }))).rejects.toMatchObject({ fields: { sku: "duplicate" } });
    });

    it("keeps a product's own SKU when it is edited", async () => {
      const { id } = await productsService.create(form());
      const f = await productsService.getForm(id);
      await expect(productsService.update(id, { ...f, name: "Renamed" })).resolves.toBeUndefined();
      expect((await productsService.get(id)).name).toBe("Renamed");
    });

    it("builds a variable product from its variations, numbering blank SKUs", async () => {
      const { id } = await productsService.create(form({ type: "variable", sku: "VAR", variations: [v("S / Red"), v("S / Blue"), v("M / Red"), v("M / Blue")] }));
      expect((await productsService.getForm(id)).variations.map((x) => x.sku)).toEqual(["VAR-1", "VAR-2", "VAR-3", "VAR-4"]);
    });

    it("rejects a variable product without variations or with a repeated name", async () => {
      await expect(productsService.create(form({ type: "variable", variations: [] }))).rejects.toMatchObject({ fields: { variations: "required" } });
      await expect(productsService.create(form({ type: "variable", variations: [v("S"), v("s")] }))).rejects.toMatchObject({ fields: { variations: "duplicate_name" } });
    });

    it("rejects a combo with no items, or one that contains itself", async () => {
      await expect(productsService.create(form({ type: "combo" }))).rejects.toMatchObject({ fields: { comboItems: "required" } });
      const { id } = await productsService.create(form());
      const own = (await productsService.getForm(id)).variations[0].id!;
      const combo = (items: { variationId: string; qty: number; unitId: string }[]) =>
        form({ type: "combo", variations: [{ ...form().variations[0], comboItems: items }] });
      const unitId = getDB().products[0].unitId;
      const c = await productsService.create(combo([{ variationId: own, qty: 2, unitId }]));
      const cf = await productsService.getForm(c.id);
      expect(cf.variations[0].comboItems).toHaveLength(1);
      const self = cf.variations[0].id!;
      await expect(productsService.update(c.id, { ...cf, variations: [{ ...cf.variations[0], comboItems: [{ variationId: self, qty: 1, unitId }] }] })).rejects.toMatchObject({ fields: { comboItems: "self" } });
      await expect(productsService.create(combo([{ variationId: self, qty: 1, unitId }]))).rejects.toMatchObject({ fields: { comboItems: "nested" } });
    });

    it("update keeps the ids of unchanged variations and drops removed ones", async () => {
      const { id } = await productsService.create(form({ type: "variable", sku: "UPD", variations: [v("S"), v("M")] }));
      const f = await productsService.getForm(id);
      const [s, m] = f.variations;
      await productsService.update(id, { ...f, variations: [{ ...s, sellPriceExc: 999 }, v("L")] });
      const after = await productsService.getForm(id);
      expect(after.variations.map((x) => x.name)).toEqual(["S", "L"]);
      expect(after.variations[0].id).toBe(s.id);
      expect(after.variations[0].sellPriceExc).toBe(999);
      expect(getDB().variations.some((x) => x.id === m.id)).toBe(false);
    });

    it("refuses to drop a variation that has transactions", async () => {
      const p = getDB().products.find((x) => x.type === "variable")!;
      const f = await productsService.getForm(p.id);
      const used = f.variations.find((x) => getDB().transactions.some((t) => t.lines.some((l) => l.variationId === x.id)))!;
      await expect(productsService.update(p.id, { ...f, variations: f.variations.filter((x) => x.id !== used.id) })).rejects.toMatchObject({ code: "variation_in_use" });
    });

    it("saves price-group prices per variation and ignores unknown groups", async () => {
      const g = getDB().priceGroups[0].id;
      const { id } = await productsService.create(form({ variations: [{ ...v("DUMMY"), groupPrices: { [g]: 110, ghost: 5 } }] }));
      expect((await productsService.getForm(id)).variations[0].groupPrices).toEqual({ [g]: 110 });
    });

    it("turning stock management off keeps the lots", async () => {
      const p = getDB().products.find((x) => x.manageStock && getDB().stockLots.some((l) => l.productId === x.id))!;
      const lots = getDB().stockLots.filter((l) => l.productId === p.id).length;
      await productsService.update(p.id, { ...(await productsService.getForm(p.id)), manageStock: false });
      expect(getDB().stockLots.filter((l) => l.productId === p.id)).toHaveLength(lots);
    });

    it("is gated by product.create and product.update", async () => {
      const { useSession } = await import("@/lib/auth/session");
      const cashier = getDB().users.find((u) => u.id === "user_cashier")!;
      useSession.setState({ userId: cashier.id });
      await expect(productsService.create(form())).rejects.toMatchObject({ code: "forbidden" });
      await expect(productsService.update(getDB().products[0].id, { ...(await productsService.getForm(getDB().products[0].id)) })).rejects.toMatchObject({ code: "forbidden" });
      useSession.setState({ userId: null });
    });
  });

  describe("opening stock", () => {
    const pick = () => {
      const p = getDB().products.find((x) => x.manageStock && x.type === "single")!;
      return { p, variationId: getDB().variations.find((x) => x.productId === p.id)!.id, locationId: p.locationIds[0] };
    };

    it("creates lots with no source transaction that count as available stock", async () => {
      const { p, variationId, locationId } = pick();
      const before = available(getDB().stockLots, variationId, locationId);
      await productsService.addOpeningStock(p.id, [{ variationId, locationId, qty: 12, unitCost: 80 }]);
      const lot = getDB().stockLots.at(-1)!;
      expect(lot).toMatchObject({ sourceTxnId: null, qtyIn: 12, qtyRemaining: 12, unitCost: 80 });
      expect(available(getDB().stockLots, variationId, locationId)).toBe(before + 12);
    });

    it("adding twice for one location adds a second lot", async () => {
      const { p, variationId, locationId } = pick();
      const n = getDB().stockLots.length;
      await productsService.addOpeningStock(p.id, [{ variationId, locationId, qty: 1, unitCost: 1 }]);
      await productsService.addOpeningStock(p.id, [{ variationId, locationId, qty: 2, unitCost: 1 }]);
      expect(getDB().stockLots).toHaveLength(n + 2);
    });

    it("rejects zero or negative quantity, and products that don't manage stock", async () => {
      const { p, variationId, locationId } = pick();
      for (const qty of [0, -3]) await expect(productsService.addOpeningStock(p.id, [{ variationId, locationId, qty, unitCost: 1 }])).rejects.toMatchObject({ fields: { qty: "positive" } });
      getDB().products.find((x) => x.id === p.id)!.manageStock = false;
      await expect(productsService.addOpeningStock(p.id, [{ variationId, locationId, qty: 1, unitCost: 1 }])).rejects.toMatchObject({ code: "stock_not_managed" });
    });

    it("rejects a location the product isn't sold at", async () => {
      const { p, variationId } = pick();
      const other = getDB().locations.find((l) => !p.locationIds.includes(l.id));
      if (!other) return;
      await expect(productsService.addOpeningStock(p.id, [{ variationId, locationId: other.id, qty: 1, unitCost: 1 }])).rejects.toMatchObject({ fields: { locationId: "not_assigned" } });
    });
  });

  describe("history", () => {
    it("lists opening lots and finished transaction lines in date order", async () => {
      const p = getDB().products.find((x) => getDB().transactions.some((t) => t.type === "sell" && t.status === "final" && t.lines.some((l) => l.productId === x.id)))!;
      const variationId = getDB().variations.find((x) => x.productId === p.id)!.id;
      await productsService.addOpeningStock(p.id, [{ variationId, locationId: p.locationIds[0], qty: 5, unitCost: 10 }]);
      const rows = await productsService.history(p.id);
      expect(rows.some((r) => r.kind === "opening" && r.delta === 5)).toBe(true);
      expect(rows.some((r) => r.kind === "sell" && r.delta < 0)).toBe(true);
      expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
      const sells = getDB().transactions.filter((t) => t.type === "sell" && t.status === "final").flatMap((t) => t.lines).filter((l) => l.productId === p.id);
      expect(rows.filter((r) => r.kind === "sell")).toHaveLength(sells.length);
    });
  });
});

describe("stockByLocation", () => {
  beforeEach(() => resetDB(structuredClone(seed)));
  it("sums remaining lots per location and variation", async () => {
    const p = getDB().products.find((x) => getDB().stockLots.some((l) => l.productId === x.id && l.qtyRemaining > 0))!;
    const rows = await productsService.stockByLocation(p.id);
    const total = getDB().stockLots.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qtyRemaining, 0);
    expect(rows.reduce((s, r) => s + r.qty, 0)).toBeCloseTo(total, 4);
    expect(rows.every((r) => r.qty > 0)).toBe(true);
  });
});

describe("catalog to POS", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("a new product with opening stock can be sold, and the sale uses the opening lot", async () => {
    const base = getDB().products[0];
    const { id } = await productsService.create({
      ...(await productsService.getForm(base.id)), name: "Fresh Item", sku: "FRESH-1",
      variations: [{ name: "DUMMY", sku: "", purchasePriceExc: 100, purchasePriceInc: 100, margin: 20, sellPriceExc: 120, sellPriceInc: 120, groupPrices: {}, image: null, comboItems: [] }],
      type: "single", taxId: null, enableSerial: false, notForSale: false, manageStock: true, active: true,
    });
    const form = await productsService.getForm(id);
    const loc = form.locationIds[0];
    await productsService.addOpeningStock(id, [{ variationId: form.variations[0].id!, locationId: loc, qty: 5, unitCost: 80 }]);

    const hit = (await posService.bySku({ locationId: loc, sku: "FRESH-1" }))!;
    expect(hit.variation.stock).toBe(5);
    const cart = addItem(emptyCart(), toCartItem(hit.product, hit.variation, 2), "new_row");
    await salesService.checkout({ cart, locationId: loc, status: "final", payments: [{ method: "cash", amount: 240 }] });

    expect(available(getDB().stockLots, form.variations[0].id!, loc)).toBe(3);
    const line = getDB().transactions.at(-1)!.lines[0];
    expect(line.unitCost).toBe(80);
    expect((await productsService.history(id)).map((r) => r.kind)).toEqual(["opening", "sell"]);
  });
});
