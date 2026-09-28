import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { posService, toCartItem } from "./pos";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("posService", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("lists only sellable products at the location", async () => {
    const res = await posService.products({ locationId: LOC_RANGO, pageSize: -1 });
    const db = getDB();
    for (const p of res.rows) {
      const src = db.products.find((x) => x.id === p.id)!;
      expect(src.active && !src.notForSale && src.locationIds.includes(LOC_RANGO)).toBe(true);
    }
    expect(res.total).toBeGreaterThan(0);
  });

  it("hides deactivated products", async () => {
    const first = (await posService.products({ locationId: LOC_RANGO, pageSize: 1 })).rows[0];
    commit((d) => { d.products.find((p) => p.id === first.id)!.active = false; });
    const ids = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.map((p) => p.id);
    expect(ids).not.toContain(first.id);
  });

  it("stock is the location's lot sum", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock)!;
    const lots = getDB().stockLots.filter((l) => l.productId === p.id && l.locationId === LOC_RANGO);
    expect(p.stock).toBeCloseTo(lots.reduce((s, l) => s + l.qtyRemaining, 0), 4);
  });

  it("finds an exact SKU first and flags it", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: 1 })).rows[0];
    const sku = p.variations[0].sku;
    const hits = await posService.search({ locationId: LOC_RANGO, term: sku.toLowerCase() });
    expect(hits[0]).toMatchObject({ exact: true });
    expect(hits[0].variation.sku).toBe(sku);
    expect(await posService.bySku({ locationId: LOC_RANGO, sku })).not.toBeNull();
    expect(await posService.bySku({ locationId: LOC_RANGO, sku: "NOPE-000" })).toBeNull();
  });

  it("toCartItem maps price, tax and stock limit", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock)!;
    const item = toCartItem(p, p.variations[0]);
    expect(item).toMatchObject({
      productId: p.id, variationId: p.variations[0].id, unitPrice: p.variations[0].unitPrice,
      taxType: p.taxType, maxQty: p.variations[0].stock,
    });
  });
});
