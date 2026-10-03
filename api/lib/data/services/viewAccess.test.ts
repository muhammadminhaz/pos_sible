import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/data/errors";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { resetDB } from "@/lib/data/store/db";
import { crud } from "./catalog";
import { lookupsService } from "./lookups";

const seed = createSeed({ seed: 42, today: "2026-09-27" });
const denied = (p: Promise<unknown>) => p.then(() => false, (e) => e instanceof ForbiddenError);

describe("who may read users, roles and printers", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("a cashier cannot list, fetch or fully list the protected tables", async () => {
    useSession.setState({ userId: "user_cashier" });
    for (const t of ["users", "roles", "printers"] as const) {
      expect(await denied(crud(t).list()), `${t}.list`).toBe(true);
      expect(await denied(crud(t).all()), `${t}.all`).toBe(true);
      expect(await denied(crud(t).get("x")), `${t}.get`).toBe(true);
    }
  });

  it("a cashier's lookups carry names for pickers but no logins, contact details or permissions", async () => {
    useSession.setState({ userId: "user_cashier" });
    const l = await lookupsService.all();
    expect(l.users.length).toBeGreaterThan(1);
    expect(l.users.every((u) => u.firstName && !u.username && !u.email && !u.password && !u.bankDetails?.accountNumber)).toBe(true);
    expect(l.roles.length).toBeGreaterThan(1);
    expect(l.roles.every((r) => r.permissions.length === 0)).toBe(true);
    expect(l.roles.map((r) => [r.id, r.isServiceStaff])).toEqual(seed.roles.map((r) => [r.id, r.isServiceStaff]));
  });

  it("an admin still sees everything", async () => {
    useSession.setState({ userId: "user_admin" });
    expect((await crud("users").all()).length).toBeGreaterThan(1);
    expect((await crud("roles").list()).rows.length).toBeGreaterThan(1);
    const l = await lookupsService.all();
    expect(l.users.some((u) => u.username)).toBe(true);
    expect(l.roles.some((r) => r.permissions.length)).toBe(true);
  });
});
