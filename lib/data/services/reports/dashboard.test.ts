import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { dashboardService } from "../dashboard";
import { resetDB } from "@/lib/data/store/db";
import { dashboardExtras, salesByDay, stockAlerts } from "./dashboard";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const today = "2026-09-28";
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.011);

describe("dashboard extras", () => {
  it("the 30-day chart has 30 consecutive days ending today and sums to the sales KPI", async () => {
    const days = salesByDay(seed, 30, today);
    expect(days).toHaveLength(30);
    expect(days[29].date).toBe(today);
    expect(days[0].date).toBe("2026-08-30");
    resetDB(structuredClone(seed));
    const k = await dashboardService.kpis({ locationId: "all", from: "2026-08-30", to: today });
    near(days.reduce((s, r) => s + r.sales, 0), k.totalSales);
  });

  it("stock alerts only list stock at or below the alert quantity, lowest first, and respect the location", () => {
    const d = structuredClone(seed);
    const p = d.products.find((x) => x.manageStock && x.locationIds.includes(LOC_RANGO))!;
    p.alertQty = 1_000_000;
    const all = stockAlerts(d);
    expect(all.some((a) => a.product === p.name)).toBe(true);
    for (let i = 1; i < all.length; i++) expect(all[i - 1].stock).toBeLessThanOrEqual(all[i].stock);
    expect(stockAlerts(d, LOC_RANGO).every((a) => a.locationName === d.locations.find((l) => l.id === LOC_RANGO)!.name)).toBe(true);
    p.alertQty = null;
    expect(stockAlerts(d).some((a) => a.product === p.name)).toBe(false);
  });

  it("due tables list only invoices with a balance, oldest first, and expiry alerts honour the alert window", () => {
    const e = dashboardExtras(seed, { today });
    for (const r of [...e.salesDue, ...e.purchasesDue]) expect(r.due).toBeGreaterThan(0);
    for (let i = 1; i < e.salesDue.length; i++) expect(e.salesDue[i - 1].date <= e.salesDue[i].date).toBe(true);
    for (const r of e.expiryAlerts) expect(r.daysLeft).toBeLessThanOrEqual(seed.settings.dashboard.stockExpiryAlertDays);
    expect(e.topProducts.length).toBeLessThanOrEqual(5);
  });
});
