import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { stockLot, transaction, type DB, type Transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { orderTotals } from "@/lib/domain/totals";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult, auditIds, type AuditRow, anyOf } from "./_util";
import { putBack, takeStock } from "./_stock";

export type TransferStatus = "pending" | "in_transit" | "completed";
export type TransferInput = {
  fromLocationId: string; toLocationId: string; date: string; status: TransferStatus;
  lines: { productId: string; variationId: string; qty: number }[]; shippingCharges: number; notes: string;
};
export type TransferFilters = ListQuery & { fromLocationId?: string; toLocationId?: string; status?: TransferStatus; from?: string; to?: string };
export type TransferRow = AuditRow & {
  id: string; date: string; refNo: string; fromName: string; toName: string; status: TransferStatus; shipping: number; total: number; itemsCount: number;
};
export type TransferDetail = Transaction & { fromName: string; toName: string; addedBy: string; lineNames: Record<string, { name: string; sku: string; unitName: string }> };

const ORDER: TransferStatus[] = ["pending", "in_transit", "completed"];

/** In transit: the stock has left the source lots. */
function dispatch(d: DB, t: Transaction) {
  for (const l of t.lines) {
    if (l.allocations.length) continue;
    const p = d.products.find((x) => x.id === l.productId);
    if (!p?.manageStock) continue;
    const { allocations, unitCost } = takeStock(d, { variationId: l.variationId, locationId: t.locationId, qty: l.qty, name: p.name });
    l.allocations = allocations;
    l.unitCost = unitCost;
    l.unitPrice = unitCost;
  }
}

/** Completed: the stock lands in the destination as lots that keep the source lots' cost, lot number and dates. */
function arrive(d: DB, t: Transaction) {
  const by = currentUser()?.user.id ?? null;
  for (const l of t.lines) {
    for (const al of l.allocations) {
      const src = d.stockLots.find((x) => x.id === al.lotId);
      d.stockLots.push(stockLot.parse({
        id: uid("lot"), createdAt: nowISO(), createdBy: by, locationId: t.transferLocationId!, variationId: l.variationId, productId: l.productId, sourceTxnId: t.id,
        lotNo: src?.lotNo ?? "", qtyIn: al.qty, qtyRemaining: al.qty, unitCost: al.unitCost, receivedAt: nowISO(), mfgDate: src?.mfgDate ?? null, expDate: src?.expDate ?? null,
      }));
    }
    const p = d.products.find((x) => x.id === l.productId);
    if (p && !p.locationIds.includes(t.transferLocationId!)) p.locationIds.push(t.transferLocationId!);
  }
}

function recompute(t: Transaction) {
  t.totals = orderTotals({ lines: t.lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: 0, taxType: "exclusive" as const })), shipping: t.shipping.charges });
  for (const l of t.lines) l.subtotal = roundMoney(l.unitPrice * l.qty);
}

export const transfersService = service("transfersService", {
  async list(f: TransferFilters = {}): Promise<ListResult<TransferRow>> {
    await delay();
    const d = getDB();
    const loc = new Map(d.locations.map((l) => [l.id, l.name]));
    const rows = d.transactions
      .filter((t) => t.type === "stock_transfer")
      .filter((t) => !f.fromLocationId || anyOf(f.fromLocationId, t.locationId))
      .filter((t) => !f.toLocationId || anyOf(f.toLocationId, t.transferLocationId))
      .filter((t) => !f.status || anyOf(f.status, t.status))
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, loc.get(t.locationId), loc.get(t.transferLocationId ?? "")))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): TransferRow => ({
        ...auditIds(t),
        id: t.id, date: t.date, refNo: t.refNo, fromName: loc.get(t.locationId) ?? "", toName: loc.get(t.transferLocationId ?? "") ?? "", status: t.status as TransferStatus,
        shipping: t.shipping.charges, total: t.totals.total, itemsCount: t.totals.itemsCount,
      }));
    return paginate(rows, f);
  },

  async get(id: string): Promise<TransferDetail> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "stock_transfer");
    if (!t) throw new NotFoundError("Transfer");
    const u = d.users.find((x) => x.id === t.createdBy);
    const lineNames: TransferDetail["lineNames"] = {};
    for (const l of t.lines) {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      lineNames[l.id] = { name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId, sku: v?.sku ?? "", unitName: d.units.find((x) => x.id === l.unitId)?.shortName ?? "" };
    }
    return {
      ...t, fromName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", toName: d.locations.find((l) => l.id === t.transferLocationId)?.name ?? "",
      addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "", lineNames,
    };
  },

  async create(input: TransferInput): Promise<{ id: string; refNo: string }> {
    await delay();
    assertCan("stock_transfer.create");
    if (input.fromLocationId === input.toLocationId) throw new ValidationError({ toLocationId: "same" });
    if (!input.lines.length) throw new ValidationError({ lines: "required" });
    if (input.shippingCharges < 0) throw new ValidationError({ shippingCharges: "invalid" });
    let out!: { id: string; refNo: string };
    commit((d) => {
      for (const id of [input.fromLocationId, input.toLocationId]) if (!d.locations.some((l) => l.id === id)) throw new NotFoundError("Location");
      const seen = new Set<string>();
      for (const l of input.lines) {
        if (!(l.qty > 0)) throw new ValidationError({ lines: "qty" });
        if (seen.has(l.variationId)) throw new ValidationError({ lines: "duplicate" });
        seen.add(l.variationId);
        if (!d.variations.some((v) => v.id === l.variationId && v.productId === l.productId)) throw new NotFoundError("Product");
      }
      const at = nowISO();
      const tid = uid("t");
      const lines = input.lines.map((l) => {
        const v = d.variations.find((x) => x.id === l.variationId)!;
        const p = d.products.find((x) => x.id === l.productId)!;
        return {
          id: uid("l"), productId: l.productId, variationId: l.variationId, unitId: p.unitId, qty: l.qty, unitPrice: v.purchasePriceExc, taxId: null, taxRate: 0, taxType: "exclusive" as const,
          discount: null, subtotal: roundMoney(v.purchasePriceExc * l.qty), unitCost: v.purchasePriceExc, allocations: [],
        };
      });
      const refNo = takeRef(d, d.settings.prefixes.stockTransfer, input.date);
      const t = transaction.parse({
        id: tid, createdAt: at, createdBy: currentUser()?.user.id ?? null, type: "stock_transfer", status: "pending", locationId: input.fromLocationId, transferLocationId: input.toLocationId,
        refNo, date: input.date, lines, shipping: { charges: input.shippingCharges }, totals: orderTotals({ lines: [] }), paymentStatus: "paid", notes: input.notes,
      });
      recompute(t);
      d.transactions.push(t);
      if (input.status !== "pending") advance(d, t, input.status);
      out = { id: tid, refNo };
    });
    return out;
  },

  /** Moves forward only: Pending → In transit → Completed. Cancelling is deleting. */
  async updateStatus(id: string, status: TransferStatus): Promise<void> {
    await delay();
    assertCan("stock_transfer.update");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "stock_transfer");
      if (!t) throw new NotFoundError("Transfer");
      advance(d, t, status);
    });
  },

  /** Reverses whatever the transfer has done so far; refused once the arrived stock has been used. */
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("stock_transfer.delete");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "stock_transfer");
      if (!t) throw new NotFoundError("Transfer");
      if (d.stockLots.some((l) => l.sourceTxnId === id && l.qtyRemaining < l.qtyIn)) throw new AppError("Stock from this transfer has already been used", "stock_used");
      d.stockLots = d.stockLots.filter((l) => l.sourceTxnId !== id);
      for (const l of t.lines) putBack(d, l.allocations);
      d.transactions = d.transactions.filter((x) => x.id !== id);
    });
  },
});

function advance(d: DB, t: Transaction, status: TransferStatus) {
  const from = ORDER.indexOf(t.status as TransferStatus);
  const to = ORDER.indexOf(status);
  if (to <= from) throw new AppError("A transfer can only move forward", "status_backwards");
  dispatch(d, t); // lines that already left the source are skipped
  if (to === 2) arrive(d, t);
  t.status = status;
  recompute(t);
}
