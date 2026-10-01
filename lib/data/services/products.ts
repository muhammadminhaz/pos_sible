import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { product as productSchema, stockLot, variation as variationSchema, type DB, type Product, type TxnType, type Variation } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, paginate, uid, type ListQuery, type ListResult } from "./_util";

/** A variation as the product form edits it. `id` is set for rows that already exist. */
export type VariationInput = Omit<Variation, "id" | "productId" | "createdAt" | "createdBy"> & { id?: string };
export type ProductFormData = Omit<Product, "id" | "createdAt" | "createdBy"> & { variations: VariationInput[] };

export type OpeningStockRow = {
  variationId: string; locationId: string; qty: number; unitCost: number; lotNo?: string; mfgDate?: string | null; expDate?: string | null;
};

export type HistoryKind = "opening" | TxnType;
export type HistoryRow = {
  key: string; date: string; kind: HistoryKind; refNo: string; locationName: string; variationName: string;
  /** Signed change to stock. */ delta: number; unitCost: number | null; unitPrice: number | null;
};

const lower = (s: string) => s.toLowerCase();
const omit = <T extends object, K extends keyof T>(o: T, ...keys: K[]): Omit<T, K> => {
  const copy = { ...o };
  for (const k of keys) delete copy[k];
  return copy;
};

const skuTaken = (d: DB, sku: string, exceptProductId?: string) =>
  d.products.some((p) => p.id !== exceptProductId && lower(p.sku) === lower(sku)) ||
  d.variations.some((v) => v.productId !== exceptProductId && lower(v.sku) === lower(sku));

/** The next free SKU: prefix + 4-digit number, above every number used so far (a counter survives deletes). */
function freeSku(d: DB, bump: boolean): string {
  const prefix = d.settings.product.skuPrefix;
  let n = d.meta.counters.SKU ?? 0;
  for (const p of d.products) {
    const m = p.sku.startsWith(prefix) ? /^\d+$/.exec(p.sku.slice(prefix.length)) : null;
    if (m) n = Math.max(n, Number(m[0]));
  }
  let sku: string;
  do sku = `${prefix}${String(++n).padStart(4, "0")}`;
  while (skuTaken(d, sku));
  if (bump) d.meta.counters.SKU = n;
  return sku;
}

const ZERO_PRICES = { purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 0, sellPriceInc: 0 };

/** Validates a form and returns the SKU plus the variations to store. Throws ValidationError. */
function prepare(d: DB, input: ProductFormData, productId: string | null): { sku: string; variations: VariationInput[] } {
  if (!input.name.trim()) throw new ValidationError({ name: "required" });
  const sku = input.sku.trim() || freeSku(d, true);
  if (skuTaken(d, sku, productId ?? undefined)) throw new ValidationError({ sku: "duplicate" });
  const groups = new Set(d.priceGroups.map((g) => g.id));
  const clean = (v: VariationInput): VariationInput => ({
    ...v,
    groupPrices: Object.fromEntries(Object.entries(v.groupPrices ?? {}).filter(([g, p]) => groups.has(g) && Number.isFinite(p))),
    comboItems: v.comboItems ?? [],
  });

  let variations: VariationInput[];
  if (input.type === "variable") {
    if (input.variations.length === 0) throw new ValidationError({ variations: "required" });
    const names = input.variations.map((v) => lower(v.name.trim()));
    if (names.some((n) => !n) || new Set(names).size !== names.length) throw new ValidationError({ variations: "duplicate_name" });
    variations = input.variations.map((v, i) => clean({ ...v, name: v.name.trim(), sku: v.sku.trim() || `${sku}-${i + 1}`, comboItems: [] }));
  } else {
    const only = clean(input.variations[0] ?? { name: "DUMMY", sku, ...ZERO_PRICES, groupPrices: {}, image: null, comboItems: [] });
    variations = [{ ...only, name: "DUMMY", sku, comboItems: input.type === "combo" ? only.comboItems : [] }];
  }

  if (input.type === "combo") {
    const items = variations[0].comboItems;
    if (items.length === 0) throw new ValidationError({ comboItems: "required" });
    for (const c of items) {
      const v = d.variations.find((x) => x.id === c.variationId);
      if (!v || !(c.qty > 0)) throw new ValidationError({ comboItems: "invalid" });
      if (v.productId === productId) throw new ValidationError({ comboItems: "self" });
      if (d.products.find((p) => p.id === v.productId)?.type === "combo") throw new ValidationError({ comboItems: "nested" });
    }
  }

  const seen = new Set<string>();
  for (const v of variations) {
    if (seen.has(lower(v.sku)) || (v.sku !== sku && skuTaken(d, v.sku, productId ?? undefined))) throw new ValidationError({ sku: "duplicate" });
    seen.add(lower(v.sku));
  }
  return { sku, variations };
}

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

  /** Everything the product form edits: the product plus its variations (with price-group prices and combo items). */
  async getForm(id: string): Promise<ProductFormData & { id: string }> {
    await delay();
    const d = getDB();
    const p = d.products.find((x) => x.id === id);
    if (!p) throw new NotFoundError("Product");
    const variations = d.variations.filter((v) => v.productId === id).map((v) => omit(v, "productId", "createdAt", "createdBy"));
    return { ...omit(p, "createdAt", "createdBy"), variations };
  },

  /** The SKU a blank SKU field would get right now. */
  async nextSku(): Promise<string> {
    await delay();
    return freeSku(getDB(), false);
  },

  async create(input: ProductFormData): Promise<{ id: string }> {
    await delay();
    assertCan("product.create");
    const id = uid("prd");
    commit((d) => {
      const { sku, variations } = prepare(d, input, null);
      const rest = omit(input, "variations");
      d.products.push(productSchema.parse({ ...rest, sku, id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null }));
      for (const v of variations) d.variations.push(variationSchema.parse({ ...v, id: uid("var"), productId: id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null }));
    });
    return { id };
  },

  /** Variations that arrive with an id keep it; ones left out are removed unless a transaction used them. */
  async update(id: string, input: ProductFormData): Promise<void> {
    await delay();
    assertCan("product.update");
    commit((d) => {
      const i = d.products.findIndex((p) => p.id === id);
      if (i < 0) throw new NotFoundError("Product");
      const { sku, variations } = prepare(d, input, id);
      const rest = omit(input, "variations");
      d.products[i] = productSchema.parse({ ...d.products[i], ...rest, sku });
      const existing = d.variations.filter((v) => v.productId === id);
      const kept = new Set(variations.map((v) => v.id).filter((x): x is string => !!x && existing.some((e) => e.id === x)));
      for (const gone of existing.filter((e) => !kept.has(e.id))) {
        if (d.transactions.some((t) => t.lines.some((l) => l.variationId === gone.id))) throw new AppError("This variation has transactions.", "variation_in_use");
      }
      const goneIds = new Set(existing.filter((e) => !kept.has(e.id)).map((e) => e.id));
      d.variations = d.variations.filter((v) => !goneIds.has(v.id));
      d.stockLots = d.stockLots.filter((l) => !goneIds.has(l.variationId));
      for (const v of variations) {
        const at = v.id && kept.has(v.id) ? d.variations.findIndex((x) => x.id === v.id) : -1;
        if (at >= 0) d.variations[at] = variationSchema.parse({ ...d.variations[at], ...v, id: d.variations[at].id, productId: id });
        else d.variations.push(variationSchema.parse({ ...v, id: uid("var"), productId: id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null }));
      }
    });
  },

  /** Adds a lot per row. A second call for the same location adds another lot; nothing is overwritten. */
  async addOpeningStock(productId: string, rows: OpeningStockRow[]): Promise<void> {
    await delay();
    assertCan("product.opening_stock");
    commit((d) => {
      const p = d.products.find((x) => x.id === productId);
      if (!p) throw new NotFoundError("Product");
      if (!p.manageStock) throw new AppError("Stock isn't managed for this product.", "stock_not_managed");
      if (rows.length === 0) throw new ValidationError({ qty: "positive" });
      for (const r of rows) {
        if (!(r.qty > 0)) throw new ValidationError({ qty: "positive" });
        if (!(r.unitCost >= 0)) throw new ValidationError({ unitCost: "invalid" });
        if (!d.variations.some((v) => v.id === r.variationId && v.productId === productId)) throw new NotFoundError("Variation");
        if (!p.locationIds.includes(r.locationId)) throw new ValidationError({ locationId: "not_assigned" });
        d.stockLots.push(stockLot.parse({
          id: uid("lot"), createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, locationId: r.locationId, variationId: r.variationId,
          productId, sourceTxnId: null, lotNo: r.lotNo ?? "", qtyIn: r.qty, qtyRemaining: r.qty, unitCost: r.unitCost, receivedAt: nowISO(),
          mfgDate: r.mfgDate ?? null, expDate: r.expDate ?? null,
        }));
      }
    });
  },

  /** Every stock movement of the product, oldest first: opening lots plus lines of finished transactions. */
  async history(id: string): Promise<HistoryRow[]> {
    await delay();
    const d = getDB();
    if (!d.products.some((p) => p.id === id)) throw new NotFoundError("Product");
    const loc = new Map(d.locations.map((l) => [l.id, l.name]));
    const vname = new Map(d.variations.filter((v) => v.productId === id).map((v) => [v.id, v.name]));
    const rows: HistoryRow[] = d.stockLots
      .filter((l) => l.productId === id && l.sourceTxnId === null)
      .map((l) => ({
        key: l.id, date: l.receivedAt, kind: "opening", refNo: l.lotNo, locationName: loc.get(l.locationId) ?? "", variationName: vname.get(l.variationId) ?? "",
        delta: l.qtyIn, unitCost: l.unitCost, unitPrice: null,
      }));
    const sign: Partial<Record<TxnType, 1 | -1>> = { purchase: 1, sell_return: 1, sell: -1, purchase_return: -1, stock_adjustment: -1, stock_transfer: -1 };
    for (const t of d.transactions) {
      const s = sign[t.type];
      if (!s || (t.type === "sell" && t.status !== "final") || (t.type === "purchase" && t.status !== "received")) continue;
      for (const l of t.lines) {
        if (l.productId !== id) continue;
        rows.push({
          key: l.id, date: t.date, kind: t.type, refNo: t.refNo, locationName: loc.get(t.locationId) ?? "", variationName: vname.get(l.variationId) ?? "",
          delta: s * l.qty, unitCost: t.type === "sell" ? l.unitCost : l.unitPrice, unitPrice: t.type === "sell" || t.type === "sell_return" ? l.unitPrice : null,
        });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
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
