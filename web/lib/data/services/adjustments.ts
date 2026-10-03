import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { orderTotals } from "@/lib/domain/totals";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult, auditIds, type AuditRow } from "./_util";
import { putBack, takeStock } from "./_stock";

export type AdjustmentInput = {
  locationId: string; date: string; type: "normal" | "abnormal"; amountRecovered: number; reason: string;
  lines: { productId: string; variationId: string; qty: number }[];
};
export type AdjustmentFilters = ListQuery & { locationId?: string; type?: "normal" | "abnormal"; from?: string; to?: string };
export type AdjustmentRow = AuditRow & {
  id: string; date: string; refNo: string; locationName: string; type: "normal" | "abnormal"; total: number; recovered: number; reason: string; addedBy: string; itemsCount: number;
};
export type AdjustmentDetail = AdjustmentRow & { lines: { id: string; name: string; sku: string; unitName: string; qty: number; unitCost: number; subtotal: number }[] };

export const adjustmentsService = service("adjustmentsService", {
  async list(f: AdjustmentFilters = {}): Promise<ListResult<AdjustmentRow> & { totals: { total: number; recovered: number } }> {
    await delay();
    const d = getDB();
    const rows = d.transactions
      .filter((t) => t.type === "stock_adjustment")
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.type || t.adjustmentType === f.type)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, t.notes))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): AdjustmentRow => {
        const u = d.users.find((x) => x.id === t.createdBy);
        return {
          ...auditIds(t),
          id: t.id, date: t.date, refNo: t.refNo, locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", type: t.adjustmentType ?? "normal", total: t.totals.total,
          recovered: t.amountRecovered, reason: t.notes, addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "", itemsCount: t.totals.itemsCount,
        };
      });
    const sum = (k: "total" | "recovered") => roundMoney(rows.reduce((s, r) => s + r[k], 0));
    return { ...paginate(rows, f), totals: { total: sum("total"), recovered: sum("recovered") } };
  },

  async get(id: string): Promise<AdjustmentDetail> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "stock_adjustment");
    if (!t) throw new NotFoundError("Adjustment");
    const u = d.users.find((x) => x.id === t.createdBy);
    return {
      ...auditIds(t),
      id: t.id, date: t.date, refNo: t.refNo, locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", type: t.adjustmentType ?? "normal", total: t.totals.total,
      recovered: t.amountRecovered, reason: t.notes, addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "", itemsCount: t.totals.itemsCount,
      lines: t.lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        const v = d.variations.find((x) => x.id === l.variationId);
        return { id: l.id, name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId, sku: v?.sku ?? "", unitName: d.units.find((x) => x.id === l.unitId)?.shortName ?? "", qty: l.qty, unitCost: l.unitCost, subtotal: l.subtotal };
      }),
    };
  },

  /** Takes the stock out of the location's lots. Without overselling allowed, more than is available is refused. */
  async create(input: AdjustmentInput): Promise<{ id: string; refNo: string; total: number }> {
    await delay();
    assertCan("stock_adjustment.create");
    if (!input.lines.length) throw new ValidationError({ lines: "required" });
    let out!: { id: string; refNo: string; total: number };
    commit((d) => {
      if (!d.locations.some((l) => l.id === input.locationId)) throw new NotFoundError("Location");
      const seen = new Set<string>();
      for (const l of input.lines) {
        if (!(l.qty > 0)) throw new ValidationError({ lines: "qty" });
        if (seen.has(l.variationId)) throw new ValidationError({ lines: "duplicate" });
        seen.add(l.variationId);
      }
      const tid = uid("t");
      const lines = input.lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        if (!p || !d.variations.some((v) => v.id === l.variationId && v.productId === p.id)) throw new NotFoundError("Product");
        if (!p.manageStock) throw new ValidationError({ lines: "not_managed" });
        const { allocations, unitCost } = takeStock(d, { variationId: l.variationId, locationId: input.locationId, qty: l.qty, name: p.name, oversell: d.settings.sale.allowOverselling });
        return {
          id: uid("l"), productId: l.productId, variationId: l.variationId, unitId: p.unitId, qty: l.qty, unitPrice: unitCost, taxId: null, taxRate: 0, taxType: "exclusive" as const,
          discount: null, subtotal: roundMoney(unitCost * l.qty), unitCost, allocations,
        };
      });
      const totals = orderTotals({ lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: 0, taxType: "exclusive" as const })) });
      const abnormal = input.type === "abnormal";
      if (abnormal && (input.amountRecovered < 0 || input.amountRecovered > totals.total)) throw new ValidationError({ amountRecovered: "invalid" });
      const refNo = takeRef(d, d.settings.prefixes.stockAdjustment, input.date);
      d.transactions.push(transaction.parse({
        id: tid, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, type: "stock_adjustment", status: "final", locationId: input.locationId, refNo, date: input.date, lines,
        totals, paymentStatus: "paid", adjustmentType: input.type, amountRecovered: abnormal ? roundMoney(input.amountRecovered) : 0, notes: input.reason,
      }));
      out = { id: tid, refNo, total: totals.total };
    });
    return out;
  },

  /** Puts the stock back. */
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("stock_adjustment.delete");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "stock_adjustment");
      if (!t) throw new NotFoundError("Adjustment");
      for (const l of t.lines) putBack(d, l.allocations);
      d.transactions = d.transactions.filter((x) => x.id !== id);
    });
  },
});
