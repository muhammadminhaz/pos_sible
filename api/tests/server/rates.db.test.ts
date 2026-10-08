import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresAvailable } from "./helpers";

const up = await postgresAvailable();

describe.runIf(up)("stored amounts keep their currency and convert for display", () => {
  let platform: typeof import("@/lib/server/platform");
  let poolMod: typeof import("@/lib/server/pool");
  let planId = "";
  let before = "BDT";

  beforeAll(async () => {
    platform = await import("@/lib/server/platform");
    poolMod = await import("@/lib/server/pool");
    await poolMod.ready();
    before = await platform.getCurrency();
    await poolMod.pool().query("INSERT INTO currency_rates (code, per_usd) VALUES ('USD', 1), ('BDT', 120), ('EUR', 0.9) ON CONFLICT (code) DO UPDATE SET per_usd = EXCLUDED.per_usd, fetched_at = now()");
    await platform.setCurrency("BDT");
    planId = (await platform.createPlan({ label: `Rates ${Date.now()}`, price: 1200, periodUnit: "month", periodCount: 1, modules: ["pos"] })).id;
  });
  afterAll(async () => {
    await platform.setCurrency(before);
    await poolMod.pool().query("DELETE FROM plans WHERE id = $1", [planId]);
  });

  const price = async () => (await platform.getPlans()).find((p) => p.id === planId)!.price;
  const stored = async () => (await poolMod.pool().query<{ price: string; currency: string }>("SELECT price, currency FROM plans WHERE id = $1", [planId])).rows[0];

  it("shows the price converted, never rewriting what was saved", async () => {
    expect(await price()).toBe(1200);
    await platform.setCurrency("USD");
    expect(await price()).toBe(10);
    await platform.setCurrency("EUR");
    expect(await price()).toBe(9);
    expect(await stored()).toEqual({ price: "1200.00", currency: "BDT" });
  });

  it("re-saving the displayed price leaves the plan in its own currency; a real edit saves in the shown currency", async () => {
    await platform.setCurrency("USD");
    await platform.updatePlan(planId, { price: 10, label: "Same price" });
    expect(await stored()).toEqual({ price: "1200.00", currency: "BDT" });
    await platform.updatePlan(planId, { price: 15 });
    expect(await stored()).toEqual({ price: "15.00", currency: "USD" });
    await platform.setCurrency("BDT");
    expect(await price()).toBe(1800);
  });

  it("reports when the rates were fetched", async () => {
    await platform.setCurrency("EUR");
    const s = await platform.getRateStatus();
    expect(s.covers).toBe(true);
    expect(s.at).not.toBeNull();
  });
});
