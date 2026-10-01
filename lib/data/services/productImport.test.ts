import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { available } from "@/lib/domain/stock";
import { productImportService as svc } from "./productImport";

const seed = createSeed({ seed: 42, today: "2026-09-27" });
const HEAD = "name,sku,unit,brand,category,sub_category,tax,tax_type,manage_stock,alert_qty,purchase_exc,sell_exc";

describe("product import", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("parses good rows and reports each bad row by number", async () => {
    const unit = getDB().units[0].name;
    const csv = [HEAD, `Good,,${unit},,,,,,,,100,150`, `,,${unit},,,,,,,,1,2`, `Bad Unit,,Nope,,,,,,,,1,2`, `Bad Num,,${unit},,,,,,,,abc,2`, `Bad Brand,,${unit},Ghost,,,,,,,1,2`].join("\n");
    const out = await svc.parseProducts(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([{ row: 3, message: "name" }, { row: 4, message: "unit" }, { row: 5, message: "number" }, { row: 6, message: "brand" }]);
  });

  it("flags a SKU that exists or repeats in the file", async () => {
    const unit = getDB().units[0].name;
    const taken = getDB().products[0].sku;
    const out = await svc.parseProducts([HEAD, `A,${taken},${unit},,,,,,,,1,2`, `B,NEW1,${unit},,,,,,,,1,2`, `C,new1,${unit},,,,,,,,1,2`].join("\n"));
    expect(out.errors).toEqual([{ row: 2, message: "sku_exists" }, { row: 4, message: "duplicate_sku" }]);
  });

  it("derives tax-inclusive prices and numbers blank SKUs on commit, recording a batch", async () => {
    const unit = getDB().units[0].name;
    const tax = getDB().taxRates.find((t) => t.rate === 5)!;
    const before = getDB().products.length;
    const out = await svc.parseProducts([HEAD, `Imported,,${unit},,,,${tax.name},,,,100,150`].join("\n"));
    const res = await svc.commitProducts(out.rows, "p.csv");
    expect(res.created).toBe(1);
    expect(getDB().products).toHaveLength(before + 1);
    const p = getDB().products.at(-1)!;
    const v = getDB().variations.find((x) => x.productId === p.id)!;
    expect(p.sku).toBeTruthy();
    expect(v).toMatchObject({ purchasePriceExc: 100, purchasePriceInc: 105, sellPriceExc: 150, sellPriceInc: 157.5, margin: 50 });
    expect(getDB().importBatches.at(-1)).toMatchObject({ kind: "products", rows: 1, recordIds: [p.id] });
  });

  it("imports nothing if any row fails at commit time", async () => {
    const unit = getDB().units[0].name;
    const out = await svc.parseProducts([HEAD, `One,,${unit},,,,,,,,1,2`, `Two,,${unit},,,,,,,,1,2`].join("\n"));
    out.rows[1].input.name = "";
    const before = getDB().products.length;
    await expect(svc.commitProducts(out.rows, "p.csv")).rejects.toMatchObject({ fields: { name: "required" } });
    expect(getDB().products).toHaveLength(before);
    expect(getDB().importBatches.filter((b) => b.kind === "products")).toHaveLength(0);
  });

  it("a missing name or unit column is one clear error", async () => {
    expect((await svc.parseProducts("sku\nA")).errors).toEqual([{ row: 1, message: "missing_columns" }]);
  });
});

describe("opening stock import", () => {
  beforeEach(() => resetDB(structuredClone(seed)));
  const target = () => {
    const p = getDB().products.find((x) => x.manageStock && x.type === "single")!;
    const v = getDB().variations.find((x) => x.productId === p.id)!;
    return { p, v, loc: getDB().locations.find((l) => l.id === p.locationIds[0])! };
  };

  it("reports unknown SKUs, bad quantities, bad dates and locations the product isn't in", async () => {
    const { v, loc } = target();
    const csv = ["sku,location,qty,unit_cost,exp_date", `${v.sku},${loc.name},5,10,2027-01-01`, `NOPE,${loc.name},5,,`, `${v.sku},${loc.name},0,,`, `${v.sku},${loc.name},1,,31/12/2027`, `${v.sku},Nowhere,1,,`].join("\n");
    const out = await svc.parseOpeningStock(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([{ row: 3, message: "sku" }, { row: 4, message: "qty" }, { row: 5, message: "exp_date" }, { row: 6, message: "location" }]);
  });

  it("adds lots (a second row for the same SKU adds a second lot) and defaults the cost to the purchase price", async () => {
    const { v, loc } = target();
    const before = available(getDB().stockLots, v.id, loc.id);
    const out = await svc.parseOpeningStock(["sku,location,qty", `${v.sku},${loc.name},4`, `${v.sku},${loc.name},6`].join("\n"));
    await svc.commitOpeningStock(out.rows, "o.csv");
    expect(available(getDB().stockLots, v.id, loc.id)).toBe(before + 10);
    const lots = getDB().stockLots.slice(-2);
    expect(lots.map((l) => l.unitCost)).toEqual([v.purchasePriceExc, v.purchasePriceExc]);
    expect(getDB().importBatches.at(-1)).toMatchObject({ kind: "opening_stock", rows: 2 });
  });
});
