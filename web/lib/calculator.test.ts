import { describe, expect, it } from "vitest";
import { CALC_INIT, calcReducer, type CalcKey } from "./calculator";

const run = (...keys: CalcKey[]) => keys.reduce(calcReducer, CALC_INIT).display;

describe("calcReducer", () => {
  it("does arithmetic", () => {
    expect(run("1", "2", "+", "3", "=")).toBe("15");
    expect(run("7", "÷", "2", "=")).toBe("3.5");
    expect(run("0", ".", "1", "+", "0", ".", "2", "=")).toBe("0.3");
  });
  it("chains left to right", () => {
    expect(run("2", "+", "3", "×", "4", "=")).toBe("20");
  });
  it("handles percent of the accumulator", () => {
    expect(run("2", "0", "0", "−", "1", "0", "%", "=")).toBe("180");
  });
  it("reports division by zero", () => {
    expect(run("5", "÷", "0", "=")).toBe("Error");
  });
  it("edits the entry", () => {
    expect(run("1", "2", "3", "⌫")).toBe("12");
    expect(run("5", "±")).toBe("-5");
  });
});
