import { commit, getDB } from "@/lib/data/store/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import type { DB, Row, TableName } from "@/lib/data/schemas";
import { assertCan } from "@/lib/auth/assertCan";
import { useSession } from "@/lib/auth/session";
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
  permission?: string;
  /** Throws if `row` (the merged result of a create/update) is invalid. `id` is set on update. */
  check?: (db: DB, row: Record<string, unknown>, id?: string) => void;
  /** Returns an error code if something still points at the row. */
  inUse?: (db: DB, id: string) => string | null;
};

const used = (code: string, hit: boolean) => (hit ? code : null);

const RULES: Partial<Record<TableName, Rules>> = {
  units: {
    permission: "product.update",
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
    permission: "product.update",
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
  brands: {
    permission: "product.update",
    inUse: (db, id) => used("brand_in_use", db.products.some((p) => p.brandId === id) || db.discounts.some((x) => x.brandId === id)),
  },
  warranties: {
    permission: "product.update",
    inUse: (db, id) => used("warranty_in_use", db.products.some((p) => p.warrantyId === id)),
  },
  priceGroups: {
    permission: "product.update",
    inUse: (db, id) =>
      used(
        "price_group_in_use",
        db.variations.some((v) => id in v.groupPrices) || db.customerGroups.some((g) => g.priceGroupId === id) || db.discounts.some((x) => x.priceGroupIds.includes(id)),
      ),
  },
  variationTemplates: {
    permission: "product.update",
    check: (_db, row) => {
      const values = (row.values as string[]).map((v) => v.trim().toLowerCase());
      if (values.some((v) => !v)) throw new ValidationError({ values: "empty_value" });
      if (new Set(values).size !== values.length) throw new ValidationError({ values: "duplicate_value" });
    },
    inUse: (db, id) => used("variation_in_use", db.products.some((p) => p.variationTemplateId === id)),
  },
  customerGroups: {
    permission: "contacts.customer",
    check: (_db, row) => {
      if (row.calcType === "selling_price_group" && !row.priceGroupId) throw new ValidationError({ priceGroupId: "required" });
      if (row.calcType === "percentage" && (typeof row.amount !== "number" || row.amount < -100 || row.amount > 100)) throw new ValidationError({ amount: "range" });
    },
    inUse: (db, id) => used("customer_group_in_use", db.contacts.some((c) => c.customerGroupId === id)),
  },
  technicians: {
    permission: "contacts.customer",
    inUse: (db, id) => used("technician_in_use", db.transactions.some((t) => t.technicianId === id)),
  },
  taxRates: {
    permission: "settings.tax",
    inUse: (db, id) => used("tax_in_use", db.products.some((p) => p.taxId === id) || db.taxRates.some((t) => t.subTaxIds.includes(id))),
  },
};

/** Generic CRUD over one table. Search looks at `name`, `code`, and `shortName` when present. */
export function crud<N extends TableName, T extends Row<N> & { id: string } = Row<N>>(table: N): CrudService<T> {
  const rules: Rules = RULES[table] ?? {};
  const guard = () => rules.permission && assertCan(rules.permission);
  const rows = () => getDB()[table] as unknown as T[];
  const find = (id: string) => {
    const row = rows().find((r) => r.id === id);
    if (!row) throw new NotFoundError();
    return row;
  };
  return {
    async list(q = {}) {
      await delay();
      const filtered = rows().filter((r) => {
        const o = r as unknown as Record<string, string | undefined>;
        return matches(q.search, o.name, o.code, o.shortName);
      });
      return paginate(filtered, q);
    },
    async all() {
      await delay();
      return rows();
    },
    async get(id) {
      await delay();
      return find(id);
    },
    async create(data) {
      await delay();
      guard();
      rules.check?.(getDB(), data as Record<string, unknown>);
      const row = { ...data, id: uid(table.slice(0, 3)), createdAt: nowISO(), createdBy: useSession.getState().userId } as unknown as T;
      commit((d) => void (d[table] as unknown as T[]).push(row));
      return row;
    },
    async update(id, patch) {
      await delay();
      guard();
      rules.check?.(getDB(), { ...find(id), ...patch }, id);
      let next!: T;
      commit((d) => {
        const list = d[table] as unknown as T[];
        const i = list.findIndex((r) => r.id === id);
        next = { ...list[i], ...patch, id };
        list[i] = next;
      });
      return next;
    },
    async remove(id) {
      await delay();
      guard();
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
