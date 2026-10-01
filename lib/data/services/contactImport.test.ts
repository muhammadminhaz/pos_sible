import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { contactImportService as svc } from "./contactImport";

const seed = createSeed({ seed: 42, today: "2026-09-27" });
const HEAD = "type,name,business_name,mobile,email,tax_number,opening_balance,credit_limit,pay_term_number,pay_term_type,address,city,customer_group";

describe("contact import", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("parses good rows and reports bad ones by row number", async () => {
    const taken = getDB().contacts.find((c) => !c.isDefault)!.mobile;
    const csv = [HEAD, "customer,Ok One,,01800000001,,,,,,,,,", "alien,Bad Type,,01800000002,,,,,,,,,", "supplier,,,01800000003,,,,,,,,,", `customer,Dup,,${taken},,,,,,,,,`,
      "customer,Num,,01800000004,,,abc,,,,,,", "customer,Grp,,01800000005,,,,,,,,,Nope", "customer,Again,,01800000001,,,,,,,,,"].join("\n");
    const out = await svc.parse(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([
      { row: 3, message: "type" }, { row: 4, message: "name" }, { row: 5, message: "mobile_exists" }, { row: 6, message: "number" }, { row: 7, message: "customer_group" }, { row: 8, message: "duplicate_mobile" },
    ]);
  });

  it("commit adds numbered contacts and a batch; business name makes it a business", async () => {
    const before = getDB().contacts.length;
    const out = await svc.parse([HEAD, "supplier,Sup,Sup Ltd,01800000010,,,500,1000,30,days,Road 1,Dhaka,", "both,Both,,01800000011,,,,,,,,,"].join("\n"));
    await svc.commit(out.rows, "c.csv");
    expect(getDB().contacts).toHaveLength(before + 2);
    const sup = getDB().contacts.find((c) => c.mobile === "01800000010")!;
    expect(sup).toMatchObject({ kind: "business", openingBalance: 500, creditLimit: 1000, payTerm: { number: 30, type: "days" }, address: { city: "Dhaka" } });
    expect(sup.code).toMatch(/^CO\d{4}$/);
    expect(getDB().importBatches.at(-1)).toMatchObject({ kind: "contacts", rows: 2 });
  });

  it("needs the import permission and the required columns", async () => {
    expect((await svc.parse("name\nx")).errors).toEqual([{ row: 1, message: "missing_columns" }]);
    useSession.setState({ userId: "user_cashier" });
    await expect(svc.parse(HEAD)).rejects.toMatchObject({ code: "forbidden" });
  });
});
