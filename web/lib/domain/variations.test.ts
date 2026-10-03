import { describe, expect, it } from "vitest";
import { combinations } from "./variations";

describe("combinations", () => {
  it("builds the cartesian product in order", () => {
    expect(combinations([["S", "M"], ["Red", "Blue"]])).toEqual(["S / Red", "S / Blue", "M / Red", "M / Blue"]);
  });
  it("handles one dimension and none", () => {
    expect(combinations([["S", "M"]])).toEqual(["S", "M"]);
    expect(combinations([])).toEqual([]);
  });
  it("ignores an empty dimension", () => {
    expect(combinations([["S"], [], ["Red"]])).toEqual(["S / Red"]);
  });
});
