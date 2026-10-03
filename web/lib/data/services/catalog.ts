import { service } from "@/lib/data/api/facade";
import { commit, getDB } from "@/lib/data/store/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import type { DB, Row, TableName } from "@/lib/data/schemas";
import { assertCan } from "@/lib/auth/assertCan";
import { crudPerm, permissionFor, type CrudAction, type WritePermission } from "@/lib/auth/permissions";
import { passwordHasher } from "@/lib/auth/password";
import { activeUserId, currentUser } from "@/lib/auth/session";
import { delay, matches, nowISO, paginate, uid, type ListQuery, type ListResult } from "./_util";

export type CrudService<T extends { id: string }> = {
  list(q?: ListQuery): Promise<ListResult<T>>;
  all(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: Omit<T, "id" | "createdAt" | "createdBy">): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
};

/** Per-table rules: who may write, what a row must satisfy, and what stops a delete. */
type Rules = {
  /** One permission for every write, or one per action. */
  permission?: WritePermission;
  /** Needed to list or open rows. Left off for reference tables every form reads (units, tax rates...). */
  view?: string;
  /** Throws if `row` (the merged result of a create/update) is invalid. `id` is set on update. */
  check?: (db: DB, row: Record<string, unknown>, id?: string) => void;
  /** Returns an error code if something still points at the row. */
  inUse?: (db: DB, id: string) => string | null;
  /** Runs inside the update's commit, after the row is replaced, to keep dependent rows consistent. */
  onUpdate?: (db: DB, before: Record<string, unknown>, after: Record<string, unknown>) => void;
  /** Shapes incoming data before it is stored (e.g. hashing a password). */
  prepare?: (row: Record<string, unknown>) => Record<string, unknown>;
};

/** Is there an active user with a full-access role other than the given user (or in a role other than the given one)? */
function hasAnotherAdmin(db: DB, except: { userId?: string; roleId?: string }): boolean {
  return db.users.some(
    (u) => u.isActive && u.id !== except.userId && u.roleId !== except.roleId && db.roles.find((r) => r.id === u.roleId)?.permissions.includes("*"),
  );
}


/**
 * Nobody can hand out more than they hold: without this, anyone allowed to edit roles or users could promote
 * themselves to full access. Full-access users are unrestricted; with nobody signed in (tests, seed scripts) the check is off.
 */
function assertWithinOwn(perms: string[] | undefined, field: string) {
  const me = currentUser();
  if (!me || me.role.permissions.includes("*")) return;
  const mine = new Set(me.role.permissions);
  if (!perms || perms.includes("*") || perms.some((p) => !mine.has(p))) throw new ValidationError({ [field]: "exceeds_own" });
}

const used = (code: string, hit: boolean) => (hit ? code : null);

const RULES: Partial<Record<TableName, Rules>> = {
  units: {
    permission: crudPerm("catalog"),
    check: (db, row, id) => {
      const base = row.baseUnitId as string | null;
      const mult = row.multiplier as number | null;
      if (!base) {
        if (mult) throw new ValidationError({ multiplier: "needs_base" });
        return;
      }
      if (!(mult && mult > 0)) throw new ValidationError({ multiplier: "needs_multiplier" });
      const parent = db.units.find((u) => u.id === base);
      if (!parent || base === id || parent.baseUnitId) throw new ValidationError({ baseUnitId: "invalid_base" });
      if (id && db.units.some((u) => u.baseUnitId === id)) throw new ValidationError({ baseUnitId: "has_sub_units" });
    },
    inUse: (db, id) =>
      used(
        "unit_in_use",
        db.products.some((p) => p.unitId === id || p.secondaryUnitId === id || p.subUnitIds.includes(id)) ||
          db.units.some((u) => u.baseUnitId === id) ||
          db.variations.some((v) => v.comboItems.some((c) => c.unitId === id)),
      ),
  },
  categories: {
    permission: crudPerm("catalog"),
    check: (db, row, id) => {
      const parentId = row.parentId as string | null;
      if (!parentId) return;
      const parent = db.categories.find((c) => c.id === parentId);
      if (parentId === id || !parent || parent.parentId) throw new ValidationError({ parentId: "invalid_parent" });
      if (id && db.categories.some((c) => c.parentId === id)) throw new ValidationError({ parentId: "has_children" });
    },
    inUse: (db, id) =>
      db.categories.some((c) => c.parentId === id)
        ? "category_has_children"
        : used("category_in_use", db.products.some((p) => p.categoryId === id || p.subCategoryId === id) || db.discounts.some((x) => x.categoryId === id)),
  },
  expenseCategories: {
    permission: crudPerm("expense"),
    check: (db, row, id) => {
      const parentId = row.parentId as string | null;
      const was = id ? db.expenseCategories.find((c) => c.id === id) : undefined;
      if (parentId) {
        const parent = db.expenseCategories.find((c) => c.id === parentId);
        if (parentId === id || !parent || parent.parentId) throw new ValidationError({ parentId: "invalid_parent" });
        if (id && db.expenseCategories.some((c) => c.parentId === id)) throw new ValidationError({ parentId: "has_children" });
      } else if (was?.parentId && db.transactions.some((t) => t.expenseSubCategoryId === id)) {
        // Expenses filed under it as a sub-category would lose their parent.
        throw new ValidationError({ parentId: "in_use" });
      }
    },
    inUse: (db, id) =>
      db.expenseCategories.some((c) => c.parentId === id)
        ? "category_has_children"
        : used("expense_category_in_use", db.transactions.some((t) => t.expenseCategoryId === id || t.expenseSubCategoryId === id)),
    onUpdate: (db, before, after) => {
      if (before.parentId === after.parentId || !after.parentId) return;
      for (const t of db.transactions) if (t.expenseSubCategoryId === after.id) t.expenseCategoryId = after.parentId as string;
    },
  },
  accountTypes: {
    permission: { create: "account.create", update: "account.update", delete: "account.update" },
    check: (db, row, id) => {
      const parentId = row.parentId as string | null;
      if (!parentId) return;
      const parent = db.accountTypes.find((t) => t.id === parentId);
      if (parentId === id || !parent || parent.parentId) throw new ValidationError({ parentId: "invalid_parent" });
      if (id && db.accountTypes.some((t) => t.parentId === id)) throw new ValidationError({ parentId: "has_children" });
    },
    inUse: (db, id) =>
      db.accountTypes.some((t) => t.parentId === id) ? "category_has_children" : used("account_type_in_use", db.accounts.some((a) => a.typeId === id)),
  },
  brands: {
    permission: crudPerm("catalog"),
    inUse: (db, id) => used("brand_in_use", db.products.some((p) => p.brandId === id) || db.discounts.some((x) => x.brandId === id)),
  },
  warranties: {
    permission: crudPerm("catalog"),
    inUse: (db, id) => used("warranty_in_use", db.products.some((p) => p.warrantyId === id)),
  },
  priceGroups: {
    permission: crudPerm("catalog"),
    inUse: (db, id) =>
      used(
        "price_group_in_use",
        db.variations.some((v) => id in v.groupPrices) || db.customerGroups.some((g) => g.priceGroupId === id) || db.discounts.some((x) => x.priceGroupIds.includes(id)),
      ),
  },
  variationTemplates: {
    permission: crudPerm("catalog"),
    check: (_db, row) => {
      const values = (row.values as string[]).map((v) => v.trim().toLowerCase());
      if (values.some((v) => !v)) throw new ValidationError({ values: "empty_value" });
      if (new Set(values).size !== values.length) throw new ValidationError({ values: "duplicate_value" });
    },
    inUse: (db, id) => used("variation_in_use", db.products.some((p) => p.variationTemplateId === id)),
  },
  customerGroups: {
    permission: crudPerm("customer"),
    check: (_db, row) => {
      if (row.calcType === "selling_price_group" && !row.priceGroupId) throw new ValidationError({ priceGroupId: "required" });
      if (row.calcType === "percentage" && (typeof row.amount !== "number" || row.amount < -100 || row.amount > 100)) throw new ValidationError({ amount: "range" });
    },
    inUse: (db, id) => used("customer_group_in_use", db.contacts.some((c) => c.customerGroupId === id)),
  },
  technicians: {
    permission: crudPerm("customer"),
    inUse: (db, id) => used("technician_in_use", db.transactions.some((t) => t.technicianId === id)),
  },
  taxRates: {
    permission: "settings.tax",
    inUse: (db, id) => used("tax_in_use", db.products.some((p) => p.taxId === id) || db.taxRates.some((t) => t.subTaxIds.includes(id))),
  },
  barcodeSettings: { permission: "settings.barcode" },
  printers: {
    permission: "settings.printer",
    view: "settings.printer",
    // Receipt printers aren't referenced by other rows in this mock.
  },
  invoiceSchemes: {
    permission: "settings.invoice",
    inUse: (db, id) => used("scheme_in_use", db.locations.some((l) => l.invoiceSchemeId === id)),
    // Editing a scheme must never renumber existing invoices, so the counter only moves forward.
    onUpdate: (db, before, after) => {
      const row = db.invoiceSchemes.find((x) => x.id === after.id);
      if (row) row.count = Math.max(before.count as number, after.count as number);
      if (after.isDefault) for (const x of db.invoiceSchemes) if (x.id !== after.id) x.isDefault = false;
    },
  },
  invoiceLayouts: {
    permission: "settings.invoice",
    inUse: (db, id) => used("layout_in_use", db.locations.some((l) => l.posLayoutId === id || l.saleLayoutId === id)),
    onUpdate: (db, _before, after) => {
      if (after.isDefault) for (const x of db.invoiceLayouts) if (x.id !== after.id) x.isDefault = false;
    },
  },
  locations: {
    permission: "settings.location",
    check: (db, row, id) => {
      if (!(row.name as string)?.trim()) throw new ValidationError({ name: "required" });
      if (row.active === false && !db.locations.some((l) => l.id !== id && l.active)) throw new ValidationError({ active: "last_location" });
    },
    inUse: (db, id) => used("location_in_use", db.transactions.some((t) => t.locationId === id)),
  },
  roles: {
    permission: crudPerm("role"),
    view: "role.view",
    check: (db, row, id) => {
      const name = (row.name as string)?.trim();
      if (!name) throw new ValidationError({ name: "required" });
      if (db.roles.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) throw new ValidationError({ name: "duplicate" });
      const perms = row.permissions as string[];
      assertWithinOwn(perms, "permissions");
      if (id) assertWithinOwn(db.roles.find((r) => r.id === id)?.permissions, "permissions");
      if (id && !perms.includes("*") && !hasAnotherAdmin(db, { roleId: id })) throw new ValidationError({ permissions: "last_admin" });
    },
    inUse: (db, id) => used("role_in_use", db.users.some((u) => u.roleId === id)),
  },
  users: {
    permission: crudPerm("user"),
    view: "user.view",
    prepare: (row) => (typeof row.password === "string" && row.password ? { ...row, password: passwordHasher.hash(row.password) } : row),
    check: (db, row, id) => {
      const name = (row.username as string)?.trim();
      if (!name) throw new ValidationError({ username: "required" });
      if (db.users.some((u) => u.id !== id && u.username.toLowerCase() === name.toLowerCase())) throw new ValidationError({ username: "duplicate" });
      assertWithinOwn(db.roles.find((r) => r.id === row.roleId)?.permissions, "roleId");
      if (id) {
        const target = db.users.find((u) => u.id === id);
        if (target && target.id !== activeUserId()) assertWithinOwn(db.roles.find((r) => r.id === target.roleId)?.permissions, "roleId");
        const active = row.isActive !== false;
        if (!active && id === activeUserId()) throw new ValidationError({ isActive: "self" });
        const before = db.users.find((u) => u.id === id);
        const wasAdmin = before?.isActive && db.roles.find((r) => r.id === before.roleId)?.permissions.includes("*");
        const stillAdmin = active && db.roles.find((r) => r.id === row.roleId)?.permissions.includes("*");
        if (wasAdmin && !stillAdmin && !hasAnotherAdmin(db, { userId: id })) throw new ValidationError({ roleId: "last_admin" });
      }
    },
    inUse: (db, id) => {
      if (id === activeUserId()) return "user_self";
      const u = db.users.find((x) => x.id === id);
      const admin = u?.isActive && db.roles.find((r) => r.id === u.roleId)?.permissions.includes("*");
      if (admin && !hasAnotherAdmin(db, { userId: id })) return "last_admin";
      return used("user_in_use", db.transactions.some((t) => t.createdBy === id));
    },
  },
};

/** Generic CRUD over one table. Search looks at `name`, `code`, and `shortName` when present. */
function crudLocal<N extends TableName, T extends Row<N> & { id: string } = Row<N>>(table: N): CrudService<T> {
  const rules: Rules = RULES[table] ?? {};
  const guard = (action: CrudAction) => {
    if (rules.permission) assertCan(permissionFor(rules.permission, action));
  };
  const guardView = () => {
    if (rules.view) assertCan(rules.view);
  };
  const rows = () => getDB()[table] as unknown as T[];
  const find = (id: string) => {
    const row = rows().find((r) => r.id === id);
    if (!row) throw new NotFoundError();
    return row;
  };
  return {
    async list(q = {}) {
      await delay();
      guardView();
      const filtered = rows().filter((r) => {
        const o = r as unknown as Record<string, string | undefined>;
        return matches(q.search, o.name, o.code, o.shortName);
      });
      return paginate(filtered, q);
    },
    async all() {
      await delay();
      guardView();
      return rows();
    },
    async get(id) {
      await delay();
      guardView();
      return find(id);
    },
    async create(input) {
      await delay();
      guard("create");
      rules.check?.(getDB(), input as Record<string, unknown>);
      const data = (rules.prepare ? rules.prepare(input as Record<string, unknown>) : input) as typeof input;
      const row = { ...data, id: uid(table.slice(0, 3)), createdAt: nowISO(), createdBy: activeUserId() } as unknown as T;
      commit((d) => void (d[table] as unknown as T[]).push(row));
      return row;
    },
    async update(id, incoming) {
      await delay();
      guard("update");
      rules.check?.(getDB(), { ...find(id), ...incoming }, id);
      const patch = (rules.prepare ? rules.prepare(incoming as Record<string, unknown>) : incoming) as typeof incoming;
      let next!: T;
      commit((d) => {
        const list = d[table] as unknown as T[];
        const i = list.findIndex((r) => r.id === id);
        const before = list[i];
        next = { ...before, ...patch, id };
        list[i] = next;
        rules.onUpdate?.(d, before as Record<string, unknown>, next as Record<string, unknown>);
      });
      return next;
    },
    async remove(id) {
      await delay();
      guard("delete");
      find(id);
      const code = rules.inUse?.(getDB(), id);
      if (code) throw new AppError("This record is still in use.", code);
      commit((d) => {
        const tables = d as unknown as Record<N, T[]>;
        tables[table] = tables[table].filter((r) => r.id !== id);
      });
    },
  };
}

/** CRUD over one table: the real service on the server, a proxy to it in the browser's API mode. */
export function crud<N extends TableName, T extends Row<N> & { id: string } = Row<N>>(table: N): CrudService<T> {
  return service(`crud:${table}`, crudLocal<N, T>(table));
}

/** Server: the CRUD service for `table`, bypassing the registry (which only knows tables used since start-up). */
export const serverCrud = crudLocal;
