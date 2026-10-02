import type { DB, Product } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { findDiscount } from "@/lib/domain/discounts";
import { roundMoney } from "@/lib/domain/money";
import { resolveUnitPrice } from "@/lib/domain/pricing";
import type { DiscountInput } from "@/lib/domain/totals";
import type { AddItemInput } from "@/lib/pos/cart";
import { delay, paginate, type ListResult } from "./_util";

export type PosVariation = { id: string; name: string; sku: string; unitPrice: number; priceInc: number; stock: number };

export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  image: string | null;
  type: Product["type"];
  categoryId: string | null;
  brandId: string | null;
  unitId: string;
  unitName: string;
  allowDecimal: boolean;
  taxId: string | null;
  taxRate: number;
  taxType: "inclusive" | "exclusive";
  manageStock: boolean;
  alertQty: number | null;
  enableSerial: boolean;
  stock: number;
  priceInc: number;
  discount: DiscountInput | null;
  variations: PosVariation[];
};

export type PosCatalogQuery = {
  locationId: string;
  contactId?: string;
  categoryId?: string;
  brandId?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
};

export type PosSearchHit = { product: PosProduct; variation: PosVariation; exact: boolean };

function catalog(db: DB, locationId: string, contactId?: string): PosProduct[] {
  const loc = db.locations.find((l) => l.id === locationId);
  const contact = contactId ? db.contacts.find((c) => c.id === contactId) : undefined;
  const group = contact?.customerGroupId ? db.customerGroups.find((g) => g.id === contact.customerGroupId) : undefined;
  const units = new Map(db.units.map((u) => [u.id, u]));
  const taxes = new Map(db.taxRates.map((t) => [t.id, t.rate]));
  const vars = Map.groupBy(db.variations, (v) => v.productId);
  const stock = new Map<string, number>();
  for (const l of db.stockLots) {
    if (l.locationId === locationId) stock.set(l.variationId, (stock.get(l.variationId) ?? 0) + l.qtyRemaining);
  }
  const today = todayISO();

  return db.products
    .filter((p) => p.active && !p.notForSale && p.locationIds.includes(locationId))
    .map((p) => {
      const taxRate = p.taxId ? taxes.get(p.taxId) ?? 0 : 0;
      const variations = (vars.get(p.id) ?? []).map((v): PosVariation => {
        const base = p.taxType === "inclusive" ? v.sellPriceInc : v.sellPriceExc;
        const unitPrice = p.taxId
          ? base
          : resolveUnitPrice({ defaultPrice: base, groupPrices: v.groupPrices, priceGroupId: loc?.priceGroupId, customerGroup: group ?? null });
        const priceInc = p.taxType === "inclusive" ? unitPrice : roundMoney(unitPrice * (1 + taxRate / 100));
        return { id: v.id, name: v.name, sku: v.sku, unitPrice, priceInc, stock: roundMoney(stock.get(v.id) ?? 0, 4) };
      });
      const rule = findDiscount(db.discounts, { productId: p.id, brandId: p.brandId, categoryId: p.categoryId, locationId, at: today });
      const unit = units.get(p.unitId);
      return {
        id: p.id, name: p.name, sku: p.sku, image: p.image, type: p.type, categoryId: p.categoryId, brandId: p.brandId,
        unitId: p.unitId, unitName: unit?.shortName ?? "", allowDecimal: unit?.allowDecimal ?? false,
        taxId: p.taxId, taxRate, taxType: p.taxType, manageStock: p.manageStock, alertQty: p.alertQty, enableSerial: p.enableSerial,
        stock: roundMoney(variations.reduce((s, v) => s + v.stock, 0), 4),
        priceInc: variations[0]?.priceInc ?? 0,
        discount: rule ? { type: rule.type, amount: rule.amount } : null,
        variations,
      };
    });
}

export function toCartItem(p: PosProduct, v: PosVariation, qty = 1): AddItemInput {
  return {
    productId: p.id,
    variationId: v.id,
    name: p.type === "variable" ? `${p.name} (${v.name})` : p.name,
    sku: v.sku,
    unitId: p.unitId,
    unitName: p.unitName,
    allowDecimal: p.allowDecimal,
    qty,
    unitPrice: v.unitPrice,
    taxId: p.taxId,
    taxRate: p.taxRate,
    taxType: p.taxType,
    discount: p.discount,
    enableSerial: p.enableSerial,
    maxQty: p.manageStock ? v.stock : null,
  };
}

function rank(p: PosProduct, v: PosVariation, term: string): number {
  const name = p.name.toLowerCase();
  const sku = v.sku.toLowerCase();
  if (sku === term || (p.sku.toLowerCase() === term && p.variations.length === 1)) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term) || v.name.toLowerCase().includes(term)) return 2;
  if (sku.includes(term)) return 3;
  return -1;
}

export const posService = {
  async products(q: PosCatalogQuery): Promise<ListResult<PosProduct>> {
    await delay();
    const db = getDB();
    const featured = q.featured ? new Set(db.locations.find((l) => l.id === q.locationId)?.featuredProductIds ?? []) : null;
    const rows = catalog(db, q.locationId, q.contactId)
      .filter(
        (p) =>
          (!q.categoryId || p.categoryId === q.categoryId || db.products.find((x) => x.id === p.id)?.subCategoryId === q.categoryId) &&
          (!q.brandId || p.brandId === q.brandId) &&
          (!featured || featured.has(p.id)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return paginate(rows, { page: q.page, pageSize: q.pageSize ?? 40 });
  },

  async search(q: { locationId: string; contactId?: string; term: string; limit?: number }): Promise<PosSearchHit[]> {
    await delay();
    const term = q.term.trim().toLowerCase();
    if (!term) return [];
    return catalog(getDB(), q.locationId, q.contactId)
      .flatMap((p) => p.variations.map((v) => ({ product: p, variation: v, r: rank(p, v, term) })))
      .filter((h) => h.r >= 0)
      .sort((a, b) => a.r - b.r || a.product.name.localeCompare(b.product.name))
      .slice(0, q.limit ?? 10)
      .map(({ product, variation, r }) => ({ product, variation, exact: r === 0 }));
  },

};
