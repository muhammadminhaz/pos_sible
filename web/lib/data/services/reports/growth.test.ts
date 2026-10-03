import { describe, expect, it } from "vitest";
import { endOfMonth, format, parseISO } from "date-fns";
import { createSeed } from "@/lib/data/seed";
import { todayISO } from "@/lib/dates";
import { headline } from "./analytics";
import { forecast, goalProgress, opportunities, periodRange } from "./growth";

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
});
