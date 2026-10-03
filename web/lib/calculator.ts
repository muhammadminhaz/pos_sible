export type CalcState = { display: string; acc: number | null; op: Op | null; fresh: boolean };
export type Op = "+" | "−" | "×" | "÷";
export type CalcKey = Op | "=" | "C" | "±" | "%" | "." | "⌫" | `${number}`;

export const CALC_INIT: CalcState = { display: "0", acc: null, op: null, fresh: true };

const apply = (a: number, b: number, op: Op) =>
  op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;

const show = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e10) / 1e10) : "Error");

/** A pocket-calculator reducer: chained ops evaluate left to right, like the physical thing. */
export function calcReducer(s: CalcState, key: CalcKey): CalcState {
  const cur = Number(s.display) || 0;
  if (key === "C") return CALC_INIT;
  if (/^\d$/.test(key)) {
    if (s.fresh || s.display === "0" || s.display === "Error") return { ...s, display: key, fresh: false };
    return s.display.replace("-", "").replace(".", "").length >= 14 ? s : { ...s, display: s.display + key };
  }
  if (key === ".") {
    if (s.fresh || s.display === "Error") return { ...s, display: "0.", fresh: false };
    return s.display.includes(".") ? s : { ...s, display: s.display + "." };
  }
  if (key === "⌫") {
    if (s.fresh) return s;
    const d = s.display.slice(0, -1);
    return { ...s, display: d === "" || d === "-" ? "0" : d };
  }
  if (key === "±") return { ...s, display: show(-cur) };
  if (key === "%") return { ...s, display: show(s.acc !== null ? (s.acc * cur) / 100 : cur / 100), fresh: false };
  if (key === "=") {
    if (s.op === null || s.acc === null) return { ...s, fresh: true };
    return { display: show(apply(s.acc, cur, s.op)), acc: null, op: null, fresh: true };
  }
  // operator
  const acc = s.acc !== null && s.op && !s.fresh ? apply(s.acc, cur, s.op) : cur;
  return { display: show(acc), acc, op: key as Op, fresh: true };
}
