export type RoundingMode = "none" | "whole" | "0.05" | "0.1" | "0.5";

const STEPS: Record<Exclude<RoundingMode, "none">, number> = { whole: 1, "0.05": 0.05, "0.1": 0.1, "0.5": 0.5 };

/** Half-up rounding that survives binary float noise (1.005 → 1.01). */
export function roundMoney(n: number, precision = 2): number {
  const f = 10 ** precision;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function applyRounding(n: number, mode: RoundingMode): { total: number; roundOff: number } {
  const value = roundMoney(n);
  if (mode === "none") return { total: value, roundOff: 0 };
  const step = STEPS[mode];
  const total = roundMoney(Math.round(roundMoney(value / step, 6)) * step);
  return { total, roundOff: roundMoney(total - value) };
}

export function percentOf(base: number, pct: number): number {
  return roundMoney((base * pct) / 100);
}
