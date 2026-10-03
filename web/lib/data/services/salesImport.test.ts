import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { posService } from "./pos";
import { salesImportService } from "./salesImport";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const HEAD = "date,customer_mobile,location,sku,qty,unit_price,payment_method,paid,invoice_group";
const lotsLeft = (vid: string) =>
  getDB().stockLots.filter((l) => l.variationId === vid && l.locationId === LOC_RANGO).reduce((s, l) => s + l.qtyRemaining, 0);

async function fixture() {
  const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.type !== "combo" && x.manageStock && !x.enableSerial && x.variations[0].stock >= 5)!;
  const c = getDB().contacts.find((x) => x.type === "customer" && !x.isDefault && x.creditLimit == null)!;
  const loc = getDB().locations.find((l) => l.id === LOC_RANGO)!.name;
  return { sku: p.variations[0].sku, vid: p.variations[0].id, mobile: c.mobile, loc };
}

describe("salesImportService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("parses good rows and reports bad ones by row number", async () => {
    const f = await fixture();
    const csv = [HEAD, `2026-09-20,${f.mobile},${f.loc},${f.sku},2,,cash,0,`, `nope,${f.mobile},${f.loc},${f.sku},2,,,,`, `2026-09-20,${f.mobile},${f.loc},NOSUCH,2,,,,`, `2026-09-20,${f.mobile},${f.loc},${f.sku},0,,,,`].join("\n");
    const out = await salesImportService.parse(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([{ row: 3, message: "date" }, { row: 4, message: "sku" }, { row: 5, message: "qty" }]);
  });

  it("missing header columns are one clear error", async () => {
    const out = await salesImportService.parse("a,b\n1,2");
    expect(out.errors).toEqual([{ row: 1, message: "missing_columns" }]);
  });

  it("rows sharing invoice_group become one sale; commit records a batch", async () => {
    const f = await fixture();
    const before = lotsLeft(f.vid);
    const csv = [HEAD, `2026-09-20,${f.mobile},${f.loc},${f.sku},1,,cash,50,G1`, `2026-09-20,${f.mobile},${f.loc},${f.sku},1,,,0,G1`, `2026-09-21,${f.mobile},${f.loc},${f.sku},1,,,0,`].join("\n");
    const { rows } = await salesImportService.parse(csv);
    const out = await salesImportService.commit(rows, "sales.csv");
    expect(out.created).toBe(2);
    expect(lotsLeft(f.vid)).toBeCloseTo(before - 3, 4);
    const batch = (await salesImportService.history())[0];
    expect(batch).toMatchObject({ fileName: "sales.csv", rows: 3 });
    expect(batch.recordIds).toHaveLength(2);
    expect(getDB().transactions.filter((t) => t.importBatchId === out.batchId)).toHaveLength(2);
  });

  it("a failing sale rolls back the ones already created", async () => {
    const f = await fixture();
    const before = structuredClone(getDB());
    const csv = [HEAD, `2026-09-20,${f.mobile},${f.loc},${f.sku},1,,,0,A`, `2026-09-20,${f.mobile},${f.loc},${f.sku},999999,,,0,B`].join("\n");
    const { rows } = await salesImportService.parse(csv);
    await expect(salesImportService.commit(rows, "x.csv")).rejects.toThrow();
    expect(getDB().transactions.length).toBe(before.transactions.length);
    expect(lotsLeft(f.vid)).toBeCloseTo(before.stockLots.filter((l) => l.variationId === f.vid && l.locationId === LOC_RANGO).reduce((s, l) => s + l.qtyRemaining, 0), 4);
    expect(getDB().importBatches.length).toBe(before.importBatches.length);
  });

  it("revert removes the sales, restores stock and drops the batch", async () => {
    const f = await fixture();
    const before = lotsLeft(f.vid);
    const { rows } = await salesImportService.parse([HEAD, `2026-09-20,${f.mobile},${f.loc},${f.sku},2,,,0,`].join("\n"));
    const { batchId } = await salesImportService.commit(rows, "s.csv");
    await salesImportService.revert(batchId);
    expect(lotsLeft(f.vid)).toBeCloseTo(before, 4);
    expect(getDB().transactions.some((t) => t.importBatchId === batchId)).toBe(false);
    expect(await salesImportService.history()).toHaveLength(0);
  });
});
