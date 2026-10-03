import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { getDB } from "@/lib/data/store/db";
import { parseCSV } from "@/lib/csv";
import { delay } from "./_util";

export const PURCHASE_IMPORT_COLUMNS = ["sku", "qty", "unit_cost", "lot_no", "mfg_date", "exp_date"] as const;

export type PurchaseImportRow = {
  row: number; productId: string; variationId: string; name: string; sku: string; unitName: string; taxId: string | null; currentSellInc: number;
  qty: number; unitPrice: number; lotNo: string; mfgDate: string | null; expDate: string | null;
};
export type PurchaseImportError = { row: number; message: "missing_columns" | "sku_unknown" | "qty_invalid" | "cost_invalid" | "date_invalid" | "date_order" };
export type PurchaseImportParse = { rows: PurchaseImportRow[]; errors: PurchaseImportError[] };

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const decimal = (s: string) => (/^\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : Number.NaN);

/**
 * Reads a spreadsheet of products to receive: `sku` and `qty` are required, `unit_cost` defaults to the product's
 * current purchase price. Rows for the same SKU are merged. Nothing is applied here; the form shows the result first.
 */
export const purchaseImportService = service("purchaseImportService", {
  async parse(csv: string): Promise<PurchaseImportParse> {
    await delay();
    assertCan("purchase.create");
    const d = getDB();
    const [head, ...body] = parseCSV(csv);
    if (!head || !head.includes("sku") || !head.includes("qty")) return { rows: [], errors: [{ row: 1, message: "missing_columns" }] };
    const col = (r: string[], n: string) => (r[head.indexOf(n)] ?? "").trim();
    const rows = new Map<string, PurchaseImportRow>();
    const errors: PurchaseImportError[] = [];
    body.forEach((r, i) => {
      const row = i + 2;
      const bad = (message: PurchaseImportError["message"]) => void errors.push({ row, message });
      const sku = col(r, "sku");
      const variation = d.variations.find((v) => v.sku.toLowerCase() === sku.toLowerCase());
      const product = variation && d.products.find((p) => p.id === variation.productId && p.active);
      if (!variation || !product) return bad("sku_unknown");
      const qty = decimal(col(r, "qty"));
      if (!(qty > 0)) return bad("qty_invalid");
      const costText = col(r, "unit_cost");
      const cost = costText === "" ? variation.purchasePriceExc : decimal(costText);
      if (!(cost >= 0)) return bad("cost_invalid");
      const mfg = col(r, "mfg_date");
      const exp = col(r, "exp_date");
      if ((mfg && !isDate(mfg)) || (exp && !isDate(exp))) return bad("date_invalid");
      if (mfg && exp && exp < mfg) return bad("date_order");
      const key = `${variation.id}|${cost}|${col(r, "lot_no")}|${mfg}|${exp}`;
      const hit = rows.get(key);
      if (hit) return void (hit.qty += qty);
      const unit = d.units.find((u) => u.id === product.unitId);
      rows.set(key, {
        row, productId: product.id, variationId: variation.id, sku: variation.sku, unitName: unit?.shortName ?? "", taxId: product.taxId,
        name: product.type === "variable" ? `${product.name} (${variation.name})` : product.name, currentSellInc: variation.sellPriceInc,
        qty, unitPrice: cost, lotNo: col(r, "lot_no"), mfgDate: mfg || null, expDate: exp || null,
      });
    });
    return { rows: [...rows.values()], errors };
  },
});
