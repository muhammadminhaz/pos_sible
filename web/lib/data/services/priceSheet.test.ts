import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { priceSheetService } from "./priceSheet";

const seed = createSeed({ seed: 42, today: "2026-09-27" });

describe("priceSheetService", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("exports a row per variation with a column per price group", async () => {
    const rows = await priceSheetService.exportRows();
    expect(rows).toHaveLength(getDB().variations.length);
    for (const g of getDB().priceGroups) expect(rows[0]).toHaveProperty(g.name);
    expect(Object.keys(rows[0]).slice(0, 5)).toEqual(["sku", "name", "purchase_exc", "sell_exc", "sell_inc"]);
  });

  it("flags unknown SKUs, bad numbers and repeated SKUs by row number", async () => {
    const sku = getDB().variations[0].sku;
    const csv = ["sku,sell_exc", `${sku},100`, "NOSUCH,100", `${getDB().variations[1].sku},abc`, `${sku},5`].join("\n");
    const out = await priceSheetService.parse(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([{ row: 3, message: "sku" }, { row: 4, message: "number" }, { row: 5, message: "duplicate_sku" }]);
  });

  it("rejects negative numbers and a file with no sku column", async () => {
    const sku = getDB().variations[0].sku;
    expect((await priceSheetService.parse(`sku,sell_exc\n${sku},-5`)).errors).toEqual([{ row: 2, message: "number" }]);
    expect((await priceSheetService.parse("name\nx")).errors).toEqual([{ row: 1, message: "missing_columns" }]);
  });

  it("blank cells leave a price alone; a selling price moves the margin and the inclusive price", async () => {
    const v = getDB().variations.find((x) => getDB().products.find((p) => p.id === x.productId)?.taxId)!;
    const before = { ...v };
    const out = await priceSheetService.parse(`sku,purchase_exc,sell_exc\n${v.sku},,${v.sellPriceExc + 100}`);
    await priceSheetService.apply(out.rows, "p.csv");
    const after = getDB().variations.find((x) => x.id === v.id)!;
    expect(after.purchasePriceExc).toBe(before.purchasePriceExc);
    expect(after.sellPriceExc).toBe(before.sellPriceExc + 100);
    expect(after.sellPriceInc).toBeGreaterThan(after.sellPriceExc);
    expect(after.margin).toBeGreaterThan(before.margin);
  });

  it("a new purchase price alone keeps the selling price and moves the margin", async () => {
    const v = getDB().variations.find((x) => x.purchasePriceExc > 0)!;
    await priceSheetService.apply((await priceSheetService.parse(`sku,purchase_exc\n${v.sku},${v.purchasePriceExc * 2}`)).rows, "p.csv");
    const after = getDB().variations.find((x) => x.id === v.id)!;
    expect(after.sellPriceExc).toBe(v.sellPriceExc);
    expect(after.purchasePriceExc).toBe(v.purchasePriceExc * 2);
    expect(after.margin).toBeLessThan(v.margin);
  });

  it("sets a price-group price by group name and records a batch", async () => {
    const g = getDB().priceGroups[0];
    const v = getDB().variations[0];
    await priceSheetService.apply((await priceSheetService.parse(`sku,${g.name}\n${v.sku},77`)).rows, "p.csv");
    expect(getDB().variations.find((x) => x.id === v.id)!.groupPrices[g.id]).toBe(77);
    expect(getDB().importBatches.at(-1)).toMatchObject({ kind: "prices", rows: 1, fileName: "p.csv" });
  });
});
