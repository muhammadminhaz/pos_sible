import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ForbiddenError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { getDB, resetDB } from "@/lib/data/store/db";
import { productsService } from "../products";
import { adjustmentReport, EXPIRY_WINDOWS, stockExpiry, stockReport, stockReports } from "./stock";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const near = (a: number, b: number, eps = 0.011) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("stock report", () => {
  it("stock value matches the lots, and 'all' equals the sum of the locations (transfers never double count)", () => {
    const all = stockReport(seed, {});
    near(all.totals.valueByCost!, seed.stockLots.reduce((s, l) => s + l.qtyRemaining * l.unitCost, 0), 5);
    const a = stockReport(seed, { locationId: LOC_RANGO });
    const b = stockReport(seed, { locationId: LOC_NIPUN });
    near(all.totals.stock!, a.totals.stock! + b.totals.stock!, 0.01);
    near(all.totals.valueByCost!, a.totals.valueByCost! + b.totals.valueByCost!, 0.5);
    const r = { from: "2026-04-01", to: "2026-09-30" };
    const ranged = stockReport(seed, r);
    const rs = stockReport(seed, { ...r, locationId: LOC_RANGO }).totals.transferred! + stockReport(seed, { ...r, locationId: LOC_NIPUN }).totals.transferred!;
    near(ranged.totals.transferred!, rs, 0.01);
    expect(ranged.totals.transferred!).toBeGreaterThan(0);
  });

  it("potential profit is value at sale price minus value at cost, and sold is net of returns", () => {
    const r = stockReport(seed, { from: "2026-04-01", to: "2026-09-30" });
    for (const row of r.rows) near(row.potentialProfit, row.valueBySale - row.valueByCost);
    const sold = seed.transactions.filter((t) => t.type === "sell" && t.status === "final").flatMap((t) => t.lines).reduce((s, l) => s + l.qty, 0);
    const back = seed.transactions.filter((t) => t.type === "sell_return").flatMap((t) => t.lines).reduce((s, l) => s + l.qty, 0);
    near(r.totals.sold!, sold - back, 0.01);
  });

  it("filters by category and brand", () => {
    const cat = seed.products.find((p) => p.categoryId)!.categoryId!;
    const r = stockReport(seed, { categoryId: cat });
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.length).toBeLessThan(stockReport(seed, {}).rows.length);
  });
});

describe("stock expiry", () => {
  const today = "2026-09-28";
  it("windows are cumulative, expired is separate and nothing is lost", () => {
    const all = stockExpiry(seed, { today });
    expect(all.rows.length).toBeGreaterThan(0);
    const counts = Object.fromEntries((Object.keys(EXPIRY_WINDOWS) as (keyof typeof EXPIRY_WINDOWS)[]).map((w) => [w, stockExpiry(seed, { today, window: w }).rows.length]));
    expect(counts.week).toBeLessThanOrEqual(counts.fortnight);
    expect(counts.fortnight).toBeLessThanOrEqual(counts.month);
    expect(counts.year).toBeLessThanOrEqual(all.rows.length - counts.expired);
    for (const r of stockExpiry(seed, { today, window: "expired" }).rows) expect(r.daysLeft).toBeLessThan(0);
  });
});

describe("expiry actions", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("removing a lot zeroes it, writes an abnormal adjustment and keeps stock and journal in step", async () => {
    const lot = getDB().stockLots.find((l) => l.expDate && l.qtyRemaining > 0)!;
    const before = (await productsService.get(lot.productId)).stock;
    const { refNo } = await stockReports.removeExpired(lot.id);
    expect(getDB().stockLots.find((l) => l.id === lot.id)!.qtyRemaining).toBe(0);
    const adj = getDB().transactions.find((t) => t.refNo === refNo)!;
    expect(adj).toMatchObject({ type: "stock_adjustment", adjustmentType: "abnormal", locationId: lot.locationId });
    near(adj.totals.total, lot.qtyRemaining * lot.unitCost);
    expect(adjustmentReport(getDB(), {}).rows.some((r) => r.refNo === refNo)).toBe(true);
    expect(before).toBeDefined();
    await expect(stockReports.removeExpired(lot.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("editing an expiry date moves the lot between windows; both actions need permission", async () => {
    const lot = getDB().stockLots.find((l) => l.expDate && l.qtyRemaining > 0)!;
    await stockReports.editExpiry(lot.id, "2020-01-01");
    expect(stockExpiry(getDB(), { today: "2026-09-28", window: "expired" }).rows.some((r) => r.lotId === lot.id)).toBe(true);
    useSession.setState({ userId: "user_cashier" });
    await expect(stockReports.editExpiry(lot.id, null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(stockReports.removeExpired(lot.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("adjustment report", () => {
  it("splits normal and abnormal and nets the recovery", () => {
    const r = adjustmentReport(seed, {});
    near(r.summary.normal + r.summary.abnormal, r.summary.total);
    near(r.summary.netLoss, r.summary.total - r.summary.recovered);
    expect(r.rows.length).toBe(seed.transactions.filter((t) => t.type === "stock_adjustment").length);
  });
});
