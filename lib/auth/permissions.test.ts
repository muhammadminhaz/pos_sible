import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS } from "./permissions";
import { CASHIER_PERMISSIONS, MANAGER_PERMISSIONS } from "@/lib/data/seed/org";

describe("hasPermission", () => {
  it("grants everything to the wildcard role", () => {
    expect(hasPermission({ permissions: ["*"] }, "x")).toBe(true);
  });

  it("denies permissions the role lacks", () => {
    expect(hasPermission({ permissions: ["a"] }, "b")).toBe(false);
    expect(hasPermission({ permissions: ["a"] }, "a")).toBe(true);
  });

  it("allows ungated checks, and denies gated checks without a role", () => {
    expect(hasPermission(null, undefined)).toBe(true);
    expect(hasPermission(null, "a")).toBe(false);
  });

  it("knows every permission the seed roles use", () => {
    for (const p of [...MANAGER_PERMISSIONS, ...CASHIER_PERMISSIONS]) expect(PERMISSIONS).toContain(p);
  });
});
