import { describe, expect, it } from "vitest";
import { toCSV } from "./export";

describe("toCSV", () => {
  it("writes a header and quotes when needed", () => {
    expect(toCSV([{ name: "Walton, fridge", qty: 2 }, { name: 'He said "hi"', note: "x" }])).toBe(
      'name,qty,note\r\n"Walton, fridge",2,\r\n"He said ""hi""",,x',
    );
  });
  it("joins arrays and blanks nullish", () => {
    expect(toCSV([{ locs: ["A", "B"], n: null }])).toBe('locs,n\r\n"A, B",');
  });
});
