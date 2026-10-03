import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { purchaseImportService } from "./purchaseImport";

describe("purchaseImportService", () => {
  beforeEach(() => {
    resetDB(createSeed({ seed: 42, today: "2026-09-28" }));
    useSession.setState({ userId: "user_admin" });
  });

  it("reads rows, defaults the cost, merges repeats and reports every bad row", async () => {
    const [a, b] = getDB().variations;
    const csv = [
      "sku,qty,unit_cost,lot_no,mfg_date,exp_date",
      `${a.sku},5,,L1,2026-01-01,2027-01-01`,
      `${a.sku},3,,L1,2026-01-01,2027-01-01`,
      `${b.sku.toLowerCase()},2,12.5,,,`,
      "NOPE,1,,,,",
      `${a.sku},0,,,,`,
      `${a.sku},1,abc,,,`,
      `${a.sku},1,,,31-12-2026,`,
      `${a.sku},1,,,2027-02-01,2027-01-01`,
    ].join("\n");
    const res = await purchaseImportService.parse(csv);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ sku: a.sku, qty: 8, unitPrice: a.purchasePriceExc, lotNo: "L1" });
    expect(res.rows[1]).toMatchObject({ qty: 2, unitPrice: 12.5 });
    expect(res.errors.map((e) => [e.row, e.message])).toEqual([[5, "sku_unknown"], [6, "qty_invalid"], [7, "cost_invalid"], [8, "date_invalid"], [9, "date_order"]]);
  });

  it("needs the sku and qty columns", async () => {
    expect((await purchaseImportService.parse("name,price\nx,1")).errors[0].message).toBe("missing_columns");
  });
});
