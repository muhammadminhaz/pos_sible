import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { productsService } from "./products";

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
});
