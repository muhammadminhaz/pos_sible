import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { crud } from "@/lib/data/services/catalog";
import { contactsService } from "@/lib/data/services/contacts";
import { discountsService } from "@/lib/data/services/discounts";
import { productsService } from "@/lib/data/services/products";
import { adjustmentsService } from "@/lib/data/services/adjustments";
import { ROLE } from "@/lib/data/seed/org";
import type { AppError } from "@/lib/data/errors";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const code = async (p: Promise<unknown>) => p.then(() => null, (e: AppError) => e.code);
const as = (userId: string | null) => useSession.setState({ userId });
const brands = () => crud<"brands">("brands");

describe("created / updated by", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    as("user_admin");
  });

  it("stamps a new record with who made it and when", async () => {
    const b = await brands().create({ name: "Acme", description: "" } as never);
    const row = getDB().brands.find((x) => x.id === b.id)!;
    expect(row.createdBy).toBe("user_admin");
    expect(row.updatedBy).toBe("user_admin");
    expect(row.createdAt).toBeTruthy();
    expect(row.updatedAt).toBeTruthy();
  });

  it("an edit by someone else changes updated-by but never created-by", async () => {
    const b = await brands().create({ name: "Acme", description: "" } as never);
    as("user_manager");
    await brands().update(b.id, { name: "Acme Ltd" });
    const row = getDB().brands.find((x) => x.id === b.id)!;
    expect(row.createdBy).toBe("user_admin");
    expect(row.updatedBy).toBe("user_manager");
  });

  it("a change that touches nothing leaves the stamp alone", async () => {
    const b = await brands().create({ name: "Acme", description: "" } as never);
    const before = structuredClone(getDB().brands.find((x) => x.id === b.id)!);
    as("user_manager");
    commit(() => {});
    await brands().update(b.id, { name: "Acme" });
    expect(getDB().brands.find((x) => x.id === b.id)).toEqual(before);
  });

  it("only the rows that changed are restamped", async () => {
    const [a, b] = getDB().brands;
    as("user_manager");
    await brands().update(a.id, { name: `${a.name}!` });
    expect(getDB().brands.find((x) => x.id === a.id)!.updatedBy).toBe("user_manager");
    expect(getDB().brands.find((x) => x.id === b.id)!.updatedBy ?? null).toBe(b.updatedBy ?? null);
  });

  it("list rows carry the four fields", async () => {
    as("user_admin");
    const rows = (await productsService.list({ pageSize: 5 })).rows;
    expect(rows[0]).toHaveProperty("createdAt");
    const d = await discountsService.list({});
    expect(d.rows.every((r) => r.createdAt)).toBe(true);
  });
});

describe("create / update / delete permissions", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  const withRole = (permissions: string[]) => {
    commit((d) => {
      d.roles.find((r) => r.id === ROLE.cashier)!.permissions = permissions;
    });
    const u = getDB().users.find((x) => x.roleId === ROLE.cashier)!;
    as(u.id);
  };

  it("a role can be allowed to create but not delete", async () => {
    withRole(["catalog.create", "catalog.update"]);
    const b = await brands().create({ name: "Acme", description: "" } as never);
    expect(await code(brands().update(b.id, { name: "Acme 2" }))).toBeNull();
    expect(await code(brands().remove(b.id))).toBe("forbidden");
  });

  it("view alone allows no writes", async () => {
    withRole(["contacts.customer", "product.view"]);
    expect(await code(brands().create({ name: "X", description: "" } as never))).toBe("forbidden");
    expect(await code(contactsService.remove(["c-none"]))).toBe("not_found");
    const c = getDB().contacts.find((x) => x.type === "customer" && !x.isDefault)!;
    expect(await code(contactsService.remove([c.id]))).toBe("forbidden");
    expect(await code(contactsService.setActive([c.id], false))).toBe("forbidden");
  });

  it("products can't be hidden, moved or deleted without the matching permission", async () => {
    withRole(["product.view", "product.update"]);
    const p = getDB().products[0];
    expect(await code(productsService.setActive([p.id], false))).toBeNull();
    expect(await code(productsService.remove([p.id]))).toBe("forbidden");
    withRole(["product.view"]);
    expect(await code(productsService.setActive([p.id], true))).toBe("forbidden");
    expect(await code(productsService.setLocations([p.id], [], "add"))).toBe("forbidden");
  });

  it("each discount action has its own permission", async () => {
    withRole(["discount.view", "discount.update"]);
    const x = getDB().discounts[0];
    expect(await code(discountsService.setActive([x.id], !x.active))).toBeNull();
    expect(await code(discountsService.remove([x.id]))).toBe("forbidden");
  });

  it("deleting an adjustment needs its own permission", async () => {
    withRole(["stock_adjustment.view", "stock_adjustment.create"]);
    const t = getDB().transactions.find((x) => x.type === "stock_adjustment");
    if (t) expect(await code(adjustmentsService.remove(t.id))).toBe("forbidden");
  });

  it("nobody can give a role more than they hold", async () => {
    withRole(["role.view", "role.create", "role.update", "user.view", "user.update", "sell.view"]);
    const roles = crud<"roles">("roles");
    const fields = (p: Promise<unknown>) => p.then(() => null, (e: { fields?: Record<string, string> }) => e.fields);
    expect(await fields(roles.create({ name: "Sneaky", permissions: ["*"], isServiceStaff: false, locationIds: [] }))).toEqual({ permissions: "exceeds_own" });
    expect(await fields(roles.create({ name: "Sneaky 2", permissions: ["sell.view", "backup"], isServiceStaff: false, locationIds: [] }))).toEqual({ permissions: "exceeds_own" });
    expect(await fields(roles.create({ name: "Fine", permissions: ["sell.view"], isServiceStaff: false, locationIds: [] }))).toBeNull();
    // Nor can they edit a more powerful role, or move someone into one.
    expect(await fields(roles.update(ROLE.manager, { name: "Manager 2" }))).toEqual({ permissions: "exceeds_own" });
    const users = crud<"users">("users");
    expect(await fields(users.update("user_manager", { roleId: ROLE.admin }))).toEqual({ roleId: "exceeds_own" });
  });
});
