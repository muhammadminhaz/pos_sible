import { beforeEach, describe, expect, it } from "vitest";
import { addDays, endOfMonth, format, parseISO, subMonths } from "date-fns";
import { createSeed } from "@/lib/data/seed";
import { todayISO } from "@/lib/dates";
import { headline } from "./analytics";
import { getDB, resetDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { contactsService } from "../contacts";
import { closeGap, forecast, goalProgress, lapsedRegulars, opportunities, periodRange } from "./growth";

// The engine reads "today" from the clock, so the demo history has to end today too.
const today = todayISO(createSeed({ seed: 42 }).settings.business.timeZone);
const seed = createSeed({ seed: 42, today });
const near = (a: number, b: number, eps = 0.05) => expect(Math.abs(a - b)).toBeLessThan(eps);
const goal = (over: Partial<Parameters<typeof goalProgress>[1]> = {}) => goalProgress(seed, { id: "g", createdAt: "", createdBy: null, note: "", metric: "sales", target: 1, period: "month", ...over });

describe("forecast", () => {
  const f = forecast(seed);
  it("month to date matches the headline and the series covers the whole month", () => {
    near(f.mtd, headline(seed, { from: today.slice(0, 8) + "01", to: today }).sales);
    expect(f.series).toHaveLength(Number(format(endOfMonth(parseISO(today)), "d")));
    expect(f.series.at(-1)!.projected).toBe(f.projected);
  });
  it("projection never falls below what is already in, and joins the actual line today", () => {
    expect(f.projected).toBeGreaterThanOrEqual(f.mtd);
    const t = f.series.find((p) => p.day === today)!;
    expect(t.projected).toBe(t.actual);
  });
  const dropFrom = (back: number) => {
    const cut = format(addDays(parseISO(today), -back), "yyyy-MM-dd");
    return { ...seed, transactions: seed.transactions.filter((x) => x.date.slice(0, 10) < cut || x.date.slice(0, 10) >= today) };
  };
  it("a gap of days with no sales doesn't drag the rest of the month down", () => {
    const gap = forecast(dropFrom(10));
    expect(gap.projected - gap.mtd).toBeGreaterThan((f.projected - f.mtd) * 0.8);
  });
  it("falls back to last month's daily average when the last four weeks barely traded", () => {
    const empty = forecast(dropFrom(28));
    const perDay = empty.lastMonth / Number(format(endOfMonth(subMonths(parseISO(today), 1)), "d"));
    near(empty.projected - empty.mtd, perDay * empty.daysLeft, 1);
  });
});

describe("lapsedRegulars", () => {
  beforeEach(() => resetDB(structuredClone(seed)));
  const l = lapsedRegulars(seed);
  it("is exactly what the winBack opportunity counts", () => {
    expect(l.length).toBeGreaterThan(0);
    const w = opportunities(seed).find((o) => o.kind === "winBack");
    if (w?.kind !== "winBack") throw new Error("no winBack opportunity");
    expect(w.count).toBe(l.length);
    expect(w.impact).toBe(roundMoney(l.reduce((s, x) => s + x.basket, 0)));
    expect(w.names).toEqual(l.slice(0, 3).map((x) => seed.contacts.find((c) => c.id === x.id)!.name));
  });
  it("the customer list filter returns the same customers, in order, with visits, basket and last visit", async () => {
    const rows = (await contactsService.list({ type: "customer", lapsed: true, pageSize: -1 })).rows;
    expect(rows.map((r) => r.id)).toEqual(l.map((x) => x.id));
    expect(rows[0]).toMatchObject({ visits: l[0].visits, lastVisit: l[0].last, basket: roundMoney(l[0].basket) });
    expect(getDB().contacts.length).toBe(seed.contacts.length);
  });
  it("never lists Walk-in, however its visits look", () => {
    const walkIn = seed.contacts.find((c) => c.isDefault)!.id;
    const old = (n: number) => format(addDays(parseISO(today), -n), "yyyy-MM-dd") + "T10:00:00.000Z";
    const sale = seed.transactions.find((t) => t.type === "sell" && t.status === "final")!;
    const walkInLapsed = { ...seed, transactions: [
      ...seed.transactions.filter((t) => t.contactId !== walkIn),
      { ...sale, id: "w1", contactId: walkIn, date: old(60) }, { ...sale, id: "w2", contactId: walkIn, date: old(70) },
    ] };
    expect(lapsedRegulars(walkInLapsed).some((x) => x.id === walkIn)).toBe(false);
  });
});

describe("opportunities", () => {
  const ops = opportunities(seed);
  it("finds something to do in a busy shop, biggest first, with tips last", () => {
    expect(ops.length).toBeGreaterThan(0);
    const money = ops.filter((o) => o.kind !== "peak").map((o) => o.impact);
    expect(money).toEqual([...money].sort((a, b) => b - a));
    expect(ops.findIndex((o) => o.kind === "peak")).toBeGreaterThanOrEqual(money.length);
  });
  it("has nothing to suggest for a shop with no sales", () => {
    expect(opportunities({ ...seed, transactions: [], stockLots: [] })).toEqual([]);
  });
});

describe("goals", () => {
  it("periods are calendar month, quarter and year", () => {
    expect(periodRange("month", "2026-10-03")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("quarter", "2026-10-03", 1)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(periodRange("year", "2026-10-03")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("a reached target is achieved, a far one is behind", () => {
    expect(goal({ target: 1 }).status).toBe("achieved");
    expect(goal({ target: 1e11 }).status).toBe("behind");
  });
  it("an expense ceiling is broken once spending passes it", () => {
    expect(goal({ metric: "expenses", target: 1e11 }).status).toBe("ahead");
    expect(goal({ metric: "expenses", target: 0.01 }).status).toBe("over");
  });
  it("basket size projects as itself", () => {
    const g = goal({ metric: "aov" });
    expect(g.projected).toBe(g.value);
  });
  it("a sales goal behind pace gets a daily lift and three routes", () => {
    const g = goal({ target: 1e11 });
    if (g.daysLeft === 0) return; // last day of the month: nothing left to plan
    expect(g.plan!.perDay).toBeGreaterThan(0);
    expect(g.plan!.routes.map((r) => r.kind)).toEqual(["customers", "basket", "both"]);
  });
  it("no plan once a goal is reached, or for an expense limit", () => {
    expect(goal({ target: 1 }).plan).toBeUndefined();
    expect(goal({ metric: "expenses", target: 0.01 }).plan).toBeUndefined();
  });
});

describe("closeGap", () => {
  // October shop: 30 days left, ~25 sales a day at ৳1,240, heading for ৳38,600 short.
  const p = closeGap(38600, 30, 25, 1240);
  it("spreads the shortfall over the days left", () => expect(p.perDay).toBe(1287));
  it("every route closes the gap", () => {
    for (const r of p.routes) expect(r.adds).toBeGreaterThanOrEqual(38600);
    const basket = p.routes.find((r) => r.kind === "basket")!;
    expect(basket).toMatchObject({ customers: 0, basket: 52 });
  });
  it("mixes half the customers with a smaller basket rise", () => {
    const both = closeGap(200000, 30, 25, 1240).routes.find((r) => r.kind === "both")!;
    expect(both.customers).toBe(3);
    expect(both.basket).toBeGreaterThan(0);
  });
  it("skips the mix when one extra customer is enough", () => expect(closeGap(30000, 30, 25, 1240).routes.map((r) => r.kind)).toEqual(["customers", "basket"]));
  it("without sales to read there is a lift but no routes", () => expect(closeGap(1000, 10, 0, 0)).toMatchObject({ perDay: 100, routes: [] }));
});
