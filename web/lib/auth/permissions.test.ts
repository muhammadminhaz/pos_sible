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

describe("role upgrade and the permission matrix", () => {
  it("places every permission in exactly one row of the Roles screen", async () => {
    const { PERMISSION_MODULES, modulePermissions } = await import("./permissions");
    const placed = PERMISSION_MODULES.flatMap(modulePermissions);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("an old role keeps what it could do, and nothing more", async () => {
    const { upgradeRole, PERM_VERSION } = await import("./permissions");
    const old: { permissions: string[]; permVersion?: number } = { permissions: ["contacts.customer", "product.view", "discount.manage"] };
    const up = upgradeRole(old);
    expect(up.permVersion).toBe(PERM_VERSION);
    for (const p of ["customer.create", "customer.update", "customer.delete", "discount.create", "discount.update", "discount.delete"]) expect(up.permissions).toContain(p);
    expect(up.permissions).not.toContain("supplier.create");
    expect(up.permissions).not.toContain("product.update");
    expect(upgradeRole(up)).toBe(up);
  });
});
