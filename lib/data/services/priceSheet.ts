import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { importBatch } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { parseCSV } from "@/lib/csv";
import { marginFromPrices, recalcPrices, type PriceSet } from "@/lib/domain/pricing";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, uid } from "./_util";

export type PriceRow = {
  row: number; variationId: string; sku: string;
  purchaseExc: number | null; sellExc: number | null; sellInc: number | null;
  /** Price group id → new price. */
  groups: Record<string, number>;
};
export type PriceParse = { rows: PriceRow[]; errors: { row: number; message: string }[] };

type Fixed = "sku" | "name" | "purchase_exc" | "sell_exc" | "sell_inc";

/** Blank → "leave as is" (null); anything that isn't a number ≥ 0 → NaN so the caller can flag it. */
const num = (s: string): number | null => (s.trim() === "" ? null : /^\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : Number.NaN);

export const priceSheetService = {
  /** One record per variation: sku, name, the three prices, then one column per price group. */
  async exportRows(): Promise<Record<string, string | number>[]> {
    await delay();
    const d = getDB();
    const products = new Map(d.products.map((p) => [p.id, p]));
    return d.variations.flatMap((v) => {
      const p = products.get(v.productId);
      if (!p) return [];
      const rec: Record<string, string | number> = {
        sku: v.sku, name: v.name === "DUMMY" ? p.name : `${p.name} - ${v.name}`,
        purchase_exc: v.purchasePriceExc, sell_exc: v.sellPriceExc, sell_inc: v.sellPriceInc,
      };
      for (const g of d.priceGroups) rec[g.name] = v.groupPrices[g.id] ?? "";
      return [rec];
    });
  },

  async parse(csv: string): Promise<PriceParse> {
    await delay();
    assertCan("product.update");
    const d = getDB();
    const [head, ...body] = parseCSV(csv);
    if (!head || !head.includes("sku")) return { rows: [], errors: [{ row: 1, message: "missing_columns" }] };
    const groupCols = d.priceGroups.map((g) => ({ g, at: head.indexOf(g.name) })).filter((c) => c.at >= 0);
    const at = (name: Fixed) => head.indexOf(name);
    const bySku = new Map(d.variations.map((v) => [v.sku.toLowerCase(), v]));
    const rows: PriceRow[] = [];
    const errors: PriceParse["errors"] = [];
    const seen = new Set<string>();
    body.forEach((r, i) => {
      const row = i + 2;
      const sku = r[at("sku")] ?? "";
      const v = bySku.get(sku.toLowerCase());
      if (!v) return errors.push({ row, message: "sku" });
      if (seen.has(v.id)) return errors.push({ row, message: "duplicate_sku" });
      const cell = (col: number) => (col < 0 ? null : num(r[col] ?? ""));
      const purchaseExc = cell(at("purchase_exc"));
      const sellExc = cell(at("sell_exc"));
      const sellInc = cell(at("sell_inc"));
      if ([purchaseExc, sellExc, sellInc].some((n) => Number.isNaN(n))) return errors.push({ row, message: "number" });
      const groups: Record<string, number> = {};
      for (const { g, at: col } of groupCols) {
        const n = cell(col);
        if (Number.isNaN(n)) return errors.push({ row, message: "number" });
        if (n != null) groups[g.id] = n;
      }
      seen.add(v.id);
      rows.push({ row, variationId: v.id, sku: v.sku, purchaseExc, sellExc, sellInc, groups });
    });
    return { rows, errors };
  },

  /** Applies every row in one commit. A purchase-price change alone keeps the selling price and moves the margin. */
  async apply(rows: PriceRow[], fileName: string): Promise<{ updated: number }> {
    await delay();
    assertCan("product.update");
    commit((d) => {
      for (const r of rows) {
        const v = d.variations.find((x) => x.id === r.variationId);
        const p = d.products.find((x) => x.id === v?.productId);
        if (!v || !p) continue;
        const rate = d.taxRates.find((t) => t.id === p.taxId)?.rate ?? 0;
        let next: PriceSet = { purchasePriceExc: v.purchasePriceExc, purchasePriceInc: v.purchasePriceInc, margin: v.margin, sellPriceExc: v.sellPriceExc, sellPriceInc: v.sellPriceInc };
        if (r.purchaseExc != null) next = { ...next, purchasePriceExc: r.purchaseExc, purchasePriceInc: roundMoney(r.purchaseExc * (1 + rate / 100)) };
        if (r.sellExc != null) next = recalcPrices({ ...next, sellPriceExc: r.sellExc }, "sellPriceExc", rate);
        else if (r.sellInc != null) next = recalcPrices({ ...next, sellPriceInc: r.sellInc }, "sellPriceInc", rate);
        else next = { ...next, margin: marginFromPrices(next.purchasePriceExc, next.sellPriceExc) };
        Object.assign(v, next, { groupPrices: { ...v.groupPrices, ...r.groups } });
      }
      d.importBatches.push(importBatch.parse({
        id: uid("imp"), createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, kind: "prices", fileName, rows: rows.length, recordIds: rows.map((r) => r.variationId),
      }));
    });
    return { updated: rows.length };
  },
};
