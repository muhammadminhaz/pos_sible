import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/data/errors";
import { importBatch, PAYMENT_METHODS, type ImportBatch, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { parseCSV } from "@/lib/csv";
import { addItem, emptyCart, patchCart, setPrice, WALK_IN_ID } from "@/lib/pos/cart";
import { delay, nowISO, uid } from "./_util";
import { posService, toCartItem } from "./pos";
import { revertSale, salesService } from "./sales";

export const SALES_IMPORT_COLUMNS = ["date", "customer_mobile", "location", "sku", "qty", "unit_price", "payment_method", "paid", "invoice_group"] as const;

export type ImportRow = {
  row: number; group: string; date: string; contactId: string; locationId: string; sku: string; qty: number;
  unitPrice: number | null; method: PaymentMethod | null; paid: number;
};
export type ImportParse = { rows: ImportRow[]; errors: { row: number; message: string }[] };

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export const salesImportService = {
  async parse(csv: string): Promise<ImportParse> {
    await delay();
    assertCan("sell.import");
    const d = getDB();
    const [head, ...body] = parseCSV(csv);
    const errors: ImportParse["errors"] = [];
    if (!head || !["date", "sku", "qty"].every((c) => head.includes(c))) return { rows: [], errors: [{ row: 1, message: "missing_columns" }] };
    const col = (r: string[], name: string) => r[head.indexOf(name)] ?? "";
    const skus = new Set(d.variations.map((v) => v.sku));
    const rows: ImportRow[] = [];
    body.forEach((r, i) => {
      const row = i + 2;
      const bad = (message: string) => errors.push({ row, message });
      const date = col(r, "date");
      if (!/^\d{4}-\d{2}-\d{2}/.test(date) || Number.isNaN(Date.parse(date))) return bad("date");
      const mobile = col(r, "customer_mobile");
      const contact = mobile ? d.contacts.find((c) => c.mobile === mobile) : d.contacts.find((c) => c.isDefault || c.id === WALK_IN_ID);
      if (!contact) return bad("customer");
      const loc = col(r, "location");
      const location = loc ? d.locations.find((l) => l.name === loc || l.id === loc) : d.locations[0];
      if (!location) return bad("location");
      const sku = col(r, "sku");
      if (!skus.has(sku)) return bad("sku");
      const qty = num(col(r, "qty"));
      if (!(qty > 0)) return bad("qty");
      const price = num(col(r, "unit_price"));
      if (col(r, "unit_price") !== "" && !(price >= 0)) return bad("unit_price");
      const method = col(r, "payment_method");
      if (method && !(PAYMENT_METHODS as readonly string[]).includes(method)) return bad("payment_method");
      const paid = col(r, "paid") === "" ? 0 : num(col(r, "paid"));
      if (!(paid >= 0)) return bad("paid");
      rows.push({
        row, group: col(r, "invoice_group") || `row-${row}`, date, contactId: contact.id, locationId: location.id, sku, qty,
        unitPrice: Number.isNaN(price) ? null : price, method: (method as PaymentMethod) || null, paid,
      });
    });
    return { rows, errors };
  },

  /** Nothing is kept if any sale fails: the ones already created are rolled back. */
  async commit(rows: ImportRow[], fileName: string): Promise<{ batchId: string; created: number }> {
    await delay();
    assertCan("sell.import");
    const groups = new Map<string, ImportRow[]>();
    for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
    const created: string[] = [];
    const products = new Map<string, Awaited<ReturnType<typeof posService.products>>["rows"]>();
    try {
      for (const g of groups.values()) {
        const first = g[0];
        if (!products.has(first.locationId)) products.set(first.locationId, (await posService.products({ locationId: first.locationId, pageSize: -1 })).rows);
        let cart = patchCart(emptyCart(), { contactId: first.contactId, date: first.date.length === 10 ? `${first.date}T12:00:00` : first.date });
        for (const r of g) {
          const p = products.get(first.locationId)!.find((x) => x.variations.some((v) => v.sku === r.sku));
          const v = p?.variations.find((x) => x.sku === r.sku);
          if (!p || !v) throw new NotFoundError(`SKU ${r.sku}`);
          cart = addItem(cart, toCartItem(p, v, r.qty), "new_row");
          if (r.unitPrice != null) cart = setPrice(cart, cart.lines[cart.lines.length - 1].key, r.unitPrice);
        }
        const paid = g.reduce((s, r) => s + r.paid, 0);
        const method = g.find((r) => r.method)?.method ?? "cash";
        const res = await salesService.save({
          cart, locationId: first.locationId, status: "final", channel: "web", payments: paid > 0 ? [{ method, amount: paid }] : [],
        });
        created.push(res.id);
      }
    } catch (e) {
      commit((d) => {
        for (const id of created) {
          const t = d.transactions.find((x) => x.id === id);
          if (t) revertSale(d, t);
        }
      });
      throw e;
    }
    const batchId = uid("imp");
    commit((d) => {
      for (const t of d.transactions) if (created.includes(t.id)) t.importBatchId = batchId;
      d.importBatches.push(importBatch.parse({ id: batchId, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, kind: "sales", fileName, rows: rows.length, recordIds: created }));
    });
    return { batchId, created: created.length };
  },

  async history(): Promise<ImportBatch[]> {
    await delay();
    return getDB().importBatches.filter((b) => b.kind === "sales").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async revert(batchId: string): Promise<void> {
    await delay();
    assertCan("sell.import");
    commit((d) => {
      const b = d.importBatches.find((x) => x.id === batchId && x.kind === "sales");
      if (!b) throw new NotFoundError("Import");
      for (const id of b.recordIds) {
        const t = d.transactions.find((x) => x.id === id);
        if (t) revertSale(d, t);
      }
      d.importBatches = d.importBatches.filter((x) => x.id !== batchId);
    });
  },
};
