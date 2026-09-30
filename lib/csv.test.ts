import { describe, expect, it } from "vitest";
import { parseCSV } from "./csv";

describe("parseCSV", () => {
  it("splits rows and trims cells, skipping blank lines", () => {
    expect(parseCSV("a, b ,c\r\n\r\n1,2,3\n")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  it("handles quotes, commas and doubled quotes inside cells", () => {
    expect(parseCSV('x,"a, b","say ""hi"""')).toEqual([["x", "a, b", 'say "hi"']]);
  });
  it("keeps a trailing empty cell", () => {
    expect(parseCSV("a,b,")).toEqual([["a", "b", ""]]);
  });
});
