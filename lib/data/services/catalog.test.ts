import { beforeEach, describe, expect, it } from "vitest";
import { AppError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { crud } from "./catalog";

const seed = createSeed({ seed: 42, today: "2026-09-27" });
const code = async (p: Promise<unknown>) => p.then(() => null, (e: AppError) => e.code);
const field = async (p: Promise<unknown>) => p.then(() => null, (e: ValidationError) => e.fields);

describe("catalog crud rules", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("rejects deleting a brand, warranty, unit or category that products use", async () => {
    const p = getDB().products.find((x) => x.brandId && x.categoryId && x.warrantyId)!;
    expect(await code(crud("brands").remove(p.brandId!))).toBe("brand_in_use");
    expect(await code(crud("warranties").remove(p.warrantyId!))).toBe("warranty_in_use");
    expect(await code(crud("units").remove(p.unitId))).toBe("unit_in_use");
    const leaf = getDB().categories.find((c) => !getDB().categories.some((x) => x.parentId === c.id) && getDB().products.some((x) => x.categoryId === c.id))!;
    expect(await code(crud("categories").remove(leaf.id))).toBe("category_in_use");
  });

  it("rejects deleting a tax rate, price group or variation template that is referenced", async () => {
    const taxed = getDB().products.find((x) => x.taxId)!;
    expect(await code(crud("taxRates").remove(taxed.taxId!))).toBe("tax_in_use");
    const pg = Object.keys(getDB().variations.find((v) => Object.keys(v.groupPrices).length)!.groupPrices)[0];
    expect(await code(crud("priceGroups").remove(pg))).toBe("price_group_in_use");
    const vt = getDB().products.find((x) => x.variationTemplateId)!.variationTemplateId!;
    expect(await code(crud("variationTemplates").remove(vt))).toBe("variation_in_use");
  });

  it("deletes an unused brand", async () => {
    const b = await crud("brands").create({ name: "Temp", note: "" });
    await crud("brands").remove(b.id);
    expect(getDB().brands.some((x) => x.id === b.id)).toBe(false);
  });

  it("a multiplier needs a base unit, and a base unit needs a multiplier", async () => {
    const base = getDB().units[0];
    const mk = (extra: object) => crud("units").create({ name: "Bag", shortName: "bag", allowDecimal: false, baseUnitId: null, multiplier: null, ...extra });
    expect(await field(mk({ multiplier: 50 }))).toEqual({ multiplier: "needs_base" });
    expect(await field(mk({ baseUnitId: base.id }))).toEqual({ multiplier: "needs_multiplier" });
    const ok = await mk({ baseUnitId: base.id, multiplier: 50 });
    expect(ok.multiplier).toBe(50);
  });

  it("a unit can't be its own base or have a base that already has one", async () => {
    const [a, b] = getDB().units;
    expect(await field(crud("units").update(a.id, { baseUnitId: a.id, multiplier: 2 }))).toEqual({ baseUnitId: "invalid_base" });
    const sub = await crud("units").create({ name: "Bag", shortName: "bag", allowDecimal: false, baseUnitId: a.id, multiplier: 50 });
    expect(await field(crud("units").create({ name: "Big", shortName: "big", allowDecimal: false, baseUnitId: sub.id, multiplier: 2 }))).toEqual({ baseUnitId: "invalid_base" });
    expect(await field(crud("units").update(a.id, { baseUnitId: b.id, multiplier: 2 }))).toEqual({ baseUnitId: "has_sub_units" });
  });

  it("a category can't be its own parent or nest two levels", async () => {
    const top = getDB().categories.find((c) => !c.parentId)!;
    expect(await field(crud("categories").update(top.id, { parentId: top.id }))).toEqual({ parentId: "invalid_parent" });
    const child = await crud("categories").create({ name: "Child", code: "", description: "", parentId: top.id });
    expect(await field(crud("categories").create({ name: "Grand", code: "", description: "", parentId: child.id }))).toEqual({ parentId: "invalid_parent" });
  });

  it("deleting a category that has sub-categories is rejected", async () => {
    const top = await crud("categories").create({ name: "Parent", code: "", description: "", parentId: null });
    await crud("categories").create({ name: "Child", code: "", description: "", parentId: top.id });
    expect(await code(crud("categories").remove(top.id))).toBe("category_has_children");
  });

  it("rejects duplicate or blank variation values, ignoring case", async () => {
    const mk = (values: string[]) => crud("variationTemplates").create({ name: "Fit", values });
    expect(await field(mk(["S", "s"]))).toEqual({ values: "duplicate_value" });
    expect(await field(mk(["S", " "]))).toEqual({ values: "empty_value" });
    expect((await mk(["S", "M"])).values).toEqual(["S", "M"]);
  });

  it("customer groups need a price group or a percentage, and can't be deleted while contacts use them", async () => {
    const mk = (extra: object) => crud("customerGroups").create({ name: "G", calcType: "percentage", amount: 5, priceGroupId: null, ...extra });
    expect(await field(mk({ calcType: "selling_price_group" }))).toEqual({ priceGroupId: "required" });
    expect(await field(mk({ amount: 150 }))).toEqual({ amount: "range" });
    const used = getDB().contacts.find((c) => c.customerGroupId)!.customerGroupId!;
    expect(await code(crud("customerGroups").remove(used))).toBe("customer_group_in_use");
    const g = await mk({});
    await crud("customerGroups").remove(g.id);
  });
});
