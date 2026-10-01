import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { importBatch, type DB, type ImportBatch } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { parseCSV } from "@/lib/csv";
import { marginFromPrices, recalcPrices } from "@/lib/domain/pricing";
import { delay, nowISO, uid } from "./_util";
import { insertProduct, pushOpeningStock, type OpeningStockRow, type ProductFormData } from "./products";

export const PRODUCT_IMPORT_COLUMNS = [
  "name", "sku", "unit", "brand", "category", "sub_category", "tax", "tax_type", "manage_stock", "alert_qty",
  "purchase_exc", "sell_exc", "description", "weight", "locations",
] as const;
export const OPENING_IMPORT_COLUMNS = ["sku", "location", "qty", "unit_cost", "lot_no", "mfg_date", "exp_date"] as const;

export type ImportError = { row: number; message: string };
export type ProductParse = { rows: { row: number; input: ProductFormData }[]; errors: ImportError[] };
export type OpeningParse = { rows: { row: number; sku: string; productId: string; stock: OpeningStockRow }[]; errors: ImportError[] };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
/** "" → null (not given); a plain number ≥ 0 → itself; anything else → NaN. */
const num = (s: string): number | null => (s.trim() === "" ? null : /^\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : Number.NaN);

function reader(csv: string, required: readonly string[]) {
  const [head, ...body] = parseCSV(csv);
  if (!head || !required.every((c) => head.includes(c))) return null;
  return { body, col: (r: string[], name: string) => (r[head.indexOf(name)] ?? "").trim() };
}

function record(d: DB, kind: ImportBatch["kind"], fileName: string, rows: number, recordIds: string[]): string {
  const id = uid("imp");
  d.importBatches.push(importBatch.parse({ id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, kind, fileName, rows, recordIds }));
  return id;
}

export const productImportService = {
  async parseProducts(csv: string): Promise<ProductParse> {
    await delay();
    assertCan("product.create");
    const d = getDB();
    const rd = reader(csv, ["name", "unit"]);
    if (!rd) return { rows: [], errors: [{ row: 1, message: "missing_columns" }] };
    const errors: ImportError[] = [];
    const rows: ProductParse["rows"] = [];
    const taken = new Set([...d.products.map((p) => p.sku), ...d.variations.map((v) => v.sku)].map((s) => s.toLowerCase()));
    const seen = new Set<string>();
    rd.body.forEach((r, i) => {
      const row = i + 2;
      const bad = (message: string) => void errors.push({ row, message });
      const c = (n: string) => rd.col(r, n);
      const name = c("name");
      if (!name) return bad("name");
      const unit = d.units.find((u) => same(u.name, c("unit")) || same(u.shortName, c("unit")));
      if (!unit) return bad("unit");
      const brand = c("brand") ? d.brands.find((b) => same(b.name, c("brand"))) : null;
      if (c("brand") && !brand) return bad("brand");
      const category = c("category") ? d.categories.find((x) => !x.parentId && same(x.name, c("category"))) : null;
      if (c("category") && !category) return bad("category");
      const sub = c("sub_category") ? d.categories.find((x) => x.parentId === category?.id && same(x.name, c("sub_category"))) : null;
      if (c("sub_category") && !sub) return bad("sub_category");
      const tax = c("tax") ? d.taxRates.find((x) => same(x.name, c("tax"))) : null;
      if (c("tax") && !tax) return bad("tax");
      const taxType = c("tax_type").toLowerCase() || "exclusive";
      if (taxType !== "inclusive" && taxType !== "exclusive") return bad("tax_type");
      const manage = c("manage_stock").toLowerCase();
      if (manage && !["yes", "no", "1", "0", "true", "false"].includes(manage)) return bad("manage_stock");
      const alert = num(c("alert_qty"));
      const purchase = num(c("purchase_exc"));
      const sell = num(c("sell_exc"));
      if ([alert, purchase, sell].some((n) => Number.isNaN(n))) return bad("number");
      const sku = c("sku");
      if (sku) {
        if (taken.has(sku.toLowerCase())) return bad("sku_exists");
        if (seen.has(sku.toLowerCase())) return bad("duplicate_sku");
        seen.add(sku.toLowerCase());
      }
      const locNames = c("locations") ? c("locations").split("|").map((x) => x.trim()) : null;
      const locations = locNames ? locNames.map((n) => d.locations.find((l) => same(l.name, n))) : d.locations;
      if (locations.some((l) => !l)) return bad("location");
      const rate = tax?.rate ?? 0;
      const base = { purchasePriceExc: purchase ?? 0, purchasePriceInc: 0, margin: d.settings.business.defaultProfitPercent, sellPriceExc: sell ?? 0, sellPriceInc: 0 };
      let prices = recalcPrices(base, "purchasePriceExc", rate);
      if (sell != null) prices = recalcPrices({ ...prices, sellPriceExc: sell }, "sellPriceExc", rate);
      else prices = { ...prices, margin: marginFromPrices(prices.purchasePriceExc, prices.sellPriceExc) };
      rows.push({
        row,
        input: {
          name, sku, barcodeType: "C128", unitId: unit.id, subUnitIds: [], secondaryUnitId: null, brandId: brand?.id ?? null, categoryId: category?.id ?? null,
          subCategoryId: sub?.id ?? null, locationIds: locations.map((l) => l!.id), manageStock: !["no", "0", "false"].includes(manage), alertQty: alert,
          description: c("description"), image: null, brochure: null, expiryPeriod: null, expiryPeriodType: null, enableSerial: false, notForSale: false,
          weight: c("weight"), prepTimeMinutes: null, taxId: tax?.id ?? null, taxType, type: "single", variationTemplateId: null, warrantyId: null,
          rack: "", row: "", position: "", customFields: [], active: true,
          variations: [{ name: "DUMMY", sku: "", ...prices, groupPrices: {}, image: null, comboItems: [] }],
        },
      });
    });
    return { rows, errors };
  },

  /** All or nothing: one commit, so a row that fails validation leaves the catalogue untouched. */
  async commitProducts(rows: ProductParse["rows"], fileName: string): Promise<{ batchId: string; created: number }> {
    await delay();
    assertCan("product.create");
    let batchId = "";
    commit((d) => {
      const ids = rows.map((r) => insertProduct(d, r.input));
      batchId = record(d, "products", fileName, rows.length, ids);
    });
    return { batchId, created: rows.length };
  },

  async parseOpeningStock(csv: string): Promise<OpeningParse> {
    await delay();
    assertCan("product.opening_stock");
    const d = getDB();
    const rd = reader(csv, ["sku", "qty"]);
    if (!rd) return { rows: [], errors: [{ row: 1, message: "missing_columns" }] };
    const errors: ImportError[] = [];
    const rows: OpeningParse["rows"] = [];
    rd.body.forEach((r, i) => {
      const row = i + 2;
      const bad = (message: string) => void errors.push({ row, message });
      const c = (n: string) => rd.col(r, n);
      const v = d.variations.find((x) => same(x.sku, c("sku")));
      const p = v && d.products.find((x) => x.id === v.productId);
      if (!v || !p) return bad("sku");
      if (!p.manageStock) return bad("stock_not_managed");
      const loc = c("location") ? d.locations.find((l) => same(l.name, c("location")) || l.id === c("location")) : d.locations.find((l) => p.locationIds.includes(l.id));
      if (!loc || !p.locationIds.includes(loc.id)) return bad("location");
      const qty = num(c("qty"));
      if (qty == null || Number.isNaN(qty) || qty <= 0) return bad("qty");
      const cost = num(c("unit_cost"));
      if (Number.isNaN(cost)) return bad("unit_cost");
      for (const col of ["mfg_date", "exp_date"]) if (c(col) && !isDate(c(col))) return bad(col);
      rows.push({
        row, sku: v.sku, productId: p.id,
        stock: { variationId: v.id, locationId: loc.id, qty, unitCost: cost ?? v.purchasePriceExc, lotNo: c("lot_no"), mfgDate: c("mfg_date") || null, expDate: c("exp_date") || null },
      });
    });
    return { rows, errors };
  },

  async commitOpeningStock(rows: OpeningParse["rows"], fileName: string): Promise<{ batchId: string; created: number }> {
    await delay();
    assertCan("product.opening_stock");
    let batchId = "";
    commit((d) => {
      const ids = rows.flatMap((r) => pushOpeningStock(d, r.productId, [r.stock]));
      batchId = record(d, "opening_stock", fileName, rows.length, ids);
    });
    return { batchId, created: rows.length };
  },

  async history(kind: "products" | "opening_stock" | "prices"): Promise<ImportBatch[]> {
    await delay();
    return getDB().importBatches.filter((b) => b.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
