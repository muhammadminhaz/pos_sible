import { describe, expect, it } from "vitest";
import { code128 } from "./barcode";

describe("code128", () => {
  it("encodes start B + data + checksum + stop with the right module count", () => {
    const w = code128("HQ-00012");
    const modules = w.reduce((s, n) => s + n, 0);
    // (start + 8 chars + checksum) × 11 modules + stop 13
    expect(modules).toBe((1 + 8 + 1) * 11 + 13);
    expect(w.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]); // Start B
    expect(w.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]); // Stop
  });
  it("replaces characters outside Code 128 B with '?'", () => {
    expect(code128("ক")).toEqual(code128("?"));
  });
});
