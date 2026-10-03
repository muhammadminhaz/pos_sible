import { describe, expect, it } from "vitest";
import { registerGate } from "./gate";

describe("registerGate", () => {
  const loc = { id: "l1" };
  const reg = { id: "r1" };
  it("shows a skeleton until the location and register are known", () => {
    expect(registerGate(undefined, { isPending: false, data: reg })).toBe("loading");
    expect(registerGate(loc, { isPending: true })).toBe("loading");
  });
  it("locks the POS until a register is open at this location", () => {
    expect(registerGate(loc, { isPending: false, data: null })).toBe("locked");
    expect(registerGate(loc, { isPending: false, data: undefined })).toBe("locked");
  });
  it("opens once a register exists", () => {
    expect(registerGate(loc, { isPending: false, data: reg })).toBe("ready");
  });
});
