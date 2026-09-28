export type RangePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "thisFY" | "lastFY";
export const RANGE_PRESETS: RangePreset[] = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth", "thisFY", "lastFY"];

export type DateRange = { from: string; to: string };

// Plain calendar dates, computed in UTC so the host time zone never shifts a day.
const parse = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
};
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const { y, m, day } = parse(d);
  return iso(y, m, day + n);
};
/** Day 0 of the next month is the last day of this one. */
const monthEnd = (y: number, m: number) => iso(y, m + 1, 0);

export function presetRange(p: RangePreset, today: string, fyStartMonth: number): DateRange {
  const { y, m } = parse(today);
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const d = addDays(today, -1);
      return { from: d, to: d };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "thisMonth":
      return { from: iso(y, m, 1), to: monthEnd(y, m) };
    case "lastMonth":
      return { from: iso(y, m - 1, 1), to: monthEnd(y, m - 1) };
    case "thisFY":
    case "lastFY": {
      const startYear = (m >= fyStartMonth ? y : y - 1) - (p === "lastFY" ? 1 : 0);
      return { from: iso(startYear, fyStartMonth, 1), to: iso(startYear + 1, fyStartMonth, 0) };
    }
  }
}

/** Which preset (if any) a range corresponds to — lets the picker label "This month" instead of two dates. */
export function matchPreset(r: DateRange, today: string, fyStartMonth: number): RangePreset | undefined {
  return RANGE_PRESETS.find((p) => {
    const x = presetRange(p, today, fyStartMonth);
    return x.from === r.from && x.to === r.to;
  });
}
