import { AppError, NotFoundError } from "@/lib/data/errors";
import type { DB, Product, Variation } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay, paginate, type ListQuery, type ListResult } from "./_util";

export type ProductRow = Product & {
  unitName: string;
  categoryName?: string;
  brandName?: string;
  taxName?: string;
  locationNames: string[];
  stock: number;
  /** Net units sold (final sales − sell returns) at the filtered location. */
  unitsSold: number;
  purchasePrice: number;
  sellPrice: number;
  variations: Variation[];
};

export type ProductFilters = ListQuery & {
  type?: Product["type"];
  categoryId?: string;
  brandId?: string;
  unitId?: string;
  taxId?: string;
  locationId?: string;
  active?: "active" | "inactive";
  notForSale?: boolean;
};

function toRows(db: DB, locationId?: string): ProductRow[] {
  const unit = new Map(db.units.map((u) => [u.id, u.shortName]));
  const cat = new Map(db.categories.map((c) => [c.id, c.name]));
  const brand = new Map(db.brands.map((b) => [b.id, b.name]));
  const tax = new Map(db.taxRates.map((t) => [t.id, t.name]));
  const loc = new Map(db.locations.map((l) => [l.id, l.name]));
  const vars = Map.groupBy(db.variations, (v) => v.productId);
  const stock = new Map<string, number>();
  for (const l of db.stockLots) {
    if (locationId && l.locationId !== locationId) continue;
    stock.set(l.productId, (stock.get(l.productId) ?? 0) + l.qtyRemaining);
  }
  const sold = new Map<string, number>();
  for (const t of db.transactions) {
    if (locationId && t.locationId !== locationId) continue;
    const sign = t.type === "sell" && t.status === "final" ? 1 : t.type === "sell_return" ? -1 : 0;
    if (sign) for (const l of t.lines) sold.set(l.productId, (sold.get(l.productId) ?? 0) + sign * l.qty);
  }
  return db.products.map((p) => {
    const variations = vars.get(p.id) ?? [];
    return {
      ...p,
      unitName: unit.get(p.unitId) ?? "",
      categoryName: p.categoryId ? cat.get(p.categoryId) : undefined,
      brandName: p.brandId ? brand.get(p.brandId) : undefined,
      taxName: p.taxId ? tax.get(p.taxId) : undefined,
      locationNames: p.locationIds.map((id) => loc.get(id) ?? id),
      stock: roundMoney(stock.get(p.id) ?? 0, 4),
      unitsSold: roundMoney(sold.get(p.id) ?? 0, 4),
      purchasePrice: variations[0]?.purchasePriceExc ?? 0,
      sellPrice: variations[0]?.sellPriceInc ?? 0,
      variations,
    };
  });
}

/** exact name → name prefix → name contains → SKU/variation SKU match. Lower is better; -1 = no match. */
function rank(p: ProductRow, term: string): number {
  const name = p.name.toLowerCase();
  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term)) return 2;
  if (p.sku.toLowerCase() === term || p.variations.some((v) => v.sku.toLowerCase() === term)) return 0;
  if (p.sku.toLowerCase().includes(term) || p.variations.some((v) => v.sku.toLowerCase().includes(term))) return 3;
  return -1;
}

export const productsService = {
  async list(f: ProductFilters = {}): Promise<ListResult<ProductRow>> {
    await delay();
    const term = f.search?.trim().toLowerCase();
    let rows = toRows(getDB(), f.locationId).filter(
      (p) =>
        (!f.type || p.type === f.type) &&
        (!f.categoryId || p.categoryId === f.categoryId || p.subCategoryId === f.categoryId) &&
        (!f.brandId || p.brandId === f.brandId) &&
        (!f.unitId || p.unitId === f.unitId) &&
        (!f.taxId || p.taxId === f.taxId) &&
        (!f.locationId || p.locationIds.includes(f.locationId)) &&
        (!f.active || p.active === (f.active === "active")) &&
        (f.notForSale === undefined || p.notForSale === f.notForSale),
    );
    if (term) {
      const ranked = rows.map((p) => [p, rank(p, term)] as const).filter(([, r]) => r >= 0);
      rows = f.sort ? ranked.map(([p]) => p) : ranked.sort((a, b) => a[1] - b[1]).map(([p]) => p);
    } else if (!f.sort) {
      rows = rows.reverse(); // newest first
    }
    return paginate(rows, f);
  },

  async get(id: string): Promise<ProductRow> {
    await delay();
    const row = toRows(getDB()).find((p) => p.id === id);
    if (!row) throw new NotFoundError("Product");
    return row;
  },

  async setActive(ids: string[], active: boolean): Promise<void> {
    await delay();
    commit((d) => {
      for (const p of d.products) if (ids.includes(p.id)) p.active = active;
    });
  },

  async remove(ids: string[]): Promise<void> {
    await delay();
    const db = getDB();
    const used = db.transactions.find((t) => t.lines.some((l) => ids.includes(l.productId)));
    if (used) {
      const name = db.products.find((p) => used.lines.some((l) => l.productId === p.id && ids.includes(p.id)))?.name ?? "";
      throw new AppError(`${name} has transactions and can't be deleted. Deactivate it instead.`, "product_in_use");
    }
    commit((d) => {
      d.products = d.products.filter((p) => !ids.includes(p.id));
      d.variations = d.variations.filter((v) => !ids.includes(v.productId));
      d.stockLots = d.stockLots.filter((l) => !ids.includes(l.productId));
    });
  },

  async setLocations(ids: string[], locationIds: string[], mode: "add" | "remove"): Promise<void> {
    await delay();
    commit((d) => {
      for (const p of d.products) {
        if (!ids.includes(p.id)) continue;
        p.locationIds =
          mode === "add" ? [...new Set([...p.locationIds, ...locationIds])] : p.locationIds.filter((l) => !locationIds.includes(l));
      }
    });
  },
};
