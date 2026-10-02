import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { AppError, ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { accountService, backupsService } from "./admin";
import { crud } from "./catalog";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const code = async (p: Promise<unknown>) => p.then(() => null, (e: AppError) => e.code);
const field = async (p: Promise<unknown>) => p.then(() => null, (e: ValidationError) => e.fields);

describe("admin services", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("usernames are unique", async () => {
    const users = crud<"users">("users");
    const u = getDB().users[1];
    expect(await field(users.update(u.id, { username: getDB().users[0].username.toUpperCase() }))).toEqual({ username: "duplicate" });
  });

  it("a user can't deactivate or delete themself", async () => {
    const users = crud<"users">("users");
    expect(await field(users.update("user_admin", { isActive: false }))).toEqual({ isActive: "self" });
    expect(await code(users.remove("user_admin"))).toBe("user_self");
  });

  it("the last admin can't be demoted", async () => {
    const users = crud<"users">("users");
    const other = getDB().roles.find((r) => !r.permissions.includes("*"))!;
    expect(await field(users.update("user_admin", { roleId: other.id }))).toEqual({ roleId: "last_admin" });
    const adminRole = getDB().roles.find((r) => r.permissions.includes("*"))!;
    expect(await field(crud<"roles">("roles").update(adminRole.id, { permissions: ["sell.view"] }))).toEqual({ permissions: "last_admin" });
  });

  it("the last active location can't be deactivated", async () => {
    const locs = crud<"locations">("locations");
    const all = getDB().locations;
    for (const l of all.slice(1)) await locs.update(l.id, { active: false });
    expect(await field(locs.update(all[0].id, { active: false }))).toEqual({ active: "last_location" });
    // History is kept: a location with transactions can't be deleted.
    expect(await code(locs.remove(all[0].id))).toBe("location_in_use");
  });

  it("an invoice scheme's count only moves forward", async () => {
    const schemes = crud<"invoiceSchemes">("invoiceSchemes");
    const s = getDB().invoiceSchemes[0];
    await schemes.update(s.id, { count: 0 });
    expect(getDB().invoiceSchemes[0].count).toBe(s.count);
    await schemes.update(s.id, { count: s.count + 5 });
    expect(getDB().invoiceSchemes[0].count).toBe(s.count + 5);
  });

  it("changing a password needs the current one", async () => {
    expect(await field(accountService.changePassword("nope", "abcdef"))).toEqual({ current: "wrong" });
    await accountService.changePassword("112233", "abcdef");
    expect(getDB().users.find((u) => u.id === "user_admin")!.password).toBe("abcdef");
  });

  it("restore validates first and never partially applies", async () => {
    const before = JSON.stringify(getDB());
    expect(await code(backupsService.restore("{not json"))).toBe("invalid_backup");
    expect(await code(backupsService.restore(JSON.stringify({ ...getDB(), users: [] })))).toBe("invalid_backup");
    expect(JSON.stringify(getDB())).toBe(before);
  });

  it("create → list → restore round-trips and keeps the backup list", async () => {
    const b = await backupsService.create("t");
    const n = getDB().products.length;
    crud<"brands">("brands");
    await backupsService.restoreFrom(b.id);
    expect(getDB().products.length).toBe(n);
    expect((await backupsService.list()).map((x) => x.id)).toContain(b.id);
  });
});
