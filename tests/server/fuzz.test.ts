import { afterAll, beforeAll, describe, it } from "vitest";
import { fuzz } from "../fuzzCore";
import { postgresAvailable } from "./helpers";

const up = await postgresAvailable();

/** The same random-user test, but every action is a real server request against Postgres (frozen cache, row diffing, transactions). */
describe.runIf(up)("workflow fuzz against Postgres", () => {
  let biz = "";
  let userId = "";
  let runInBusiness: typeof import("@/lib/server/store").runInBusiness;
  let pool: typeof import("@/lib/server/pool");

  beforeAll(async () => {
    pool = await import("@/lib/server/pool");
    await import("@/lib/server/rpc");
    runInBusiness = (await import("@/lib/server/store")).runInBusiness;
    await pool.ready();
    const { createBusiness } = await import("@/lib/server/tenants");
    biz = (await createBusiness({ name: "Fuzz Co", admin: { username: `fuzz${Date.now().toString(36)}`, password: "fuzz-pass-1", firstName: "F" } })).businessId;
    userId = "user_admin";
    const { registersService } = await import("@/lib/data/services/registers");
    const { commit } = await import("@/lib/data/store/db");
    await runInBusiness(biz, userId, async () => {
      commit((d) => {
        d.settings.business.transactionEditDays = 0;
        for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
      });
      await registersService.open("loc_rango", 1000);
    });
  }, 120_000);

  afterAll(async () => {
    await pool.pool().query("DELETE FROM businesses WHERE id = $1", [biz]);
    await pool.pool().end();
  });

  for (const seedNo of [11, 12]) {
    it(`seed ${seedNo}: 120 random operations`, () => fuzz(seedNo, 120, async (fn) => (await runInBusiness(biz, userId, fn)).result), 300_000);
  }
});
