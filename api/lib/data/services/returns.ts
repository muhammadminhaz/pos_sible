import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { accountTxn, transaction, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary, type PaymentStatus } from "@/lib/domain/payments";
import { lineTotals, orderTotals, type DiscountInput } from "@/lib/domain/totals";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";
import { defaultAccountId } from "./_ledger";

export type ReturnFilters = ListQuery & { locationId?: string; contactId?: string; from?: string; to?: string; createdBy?: string };
export type ReturnRow = {
  id: string; date: string; refNo: string; parentId: string | null; parentRef: string; contactName: string; locationName: string;
  paymentStatus: PaymentStatus; total: number; due: number; addedBy: string;
};
export type ReturnableLine = { lineId: string; name: string; soldQty: number; returnedQty: number; unitPrice: number };
export type ReturnInput = { parentId: string; lines: { lineId: string; qty: number }[]; discount?: DiscountInput | null; note?: string; refundMethod?: PaymentMethod };

export const returnsService = service("returnsService", {
  async list(f: ReturnFilters = {}): Promise<ListResult<ReturnRow>> {
    await delay();
    const d = getDB();
    const contacts = new Map(d.contacts.map((c) => [c.id, c.name]));
    const parents = new Map(d.transactions.filter((t) => t.type === "sell").map((t) => [t.id, t.refNo]));
    const rows = d.transactions
      .filter((t) => t.type === "sell_return")
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.contactId || t.contactId === f.contactId)
      .filter((t) => !f.createdBy || t.createdBy === f.createdBy)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, parents.get(t.parentId ?? ""), contacts.get(t.contactId ?? "")))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): ReturnRow => {
        const u = d.users.find((x) => x.id === t.createdBy);
        return {
          id: t.id, date: t.date, refNo: t.refNo, parentId: t.parentId, parentRef: parents.get(t.parentId ?? "") ?? "",
          contactName: contacts.get(t.contactId ?? "") ?? "", locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "",
          paymentStatus: t.paymentStatus, total: t.totals.total, due: paymentSummary(t.totals.total, t.payments).due,
          addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "",
        };
      });
    return paginate(rows, f);
  },

  async parentLines(saleId: string): Promise<ReturnableLine[]> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === saleId && x.type === "sell" && x.status === "final");
    if (!t) throw new NotFoundError("Sale");
    return t.lines.map((l) => {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      return {
        lineId: l.id, name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId,
        soldQty: l.qty, returnedQty: l.returnedQty, unitPrice: l.unitPrice,
      };
    });
  },

  async create(input: ReturnInput): Promise<{ id: string; refNo: string; total: number }> {
    await delay();
    assertCan("sell.create");
    const picked = input.lines.filter((l) => l.qty > 0);
    if (!picked.length || picked.length !== input.lines.length) throw new ValidationError({ lines: "required" });
    let out!: { id: string; refNo: string; total: number };
    commit((d) => {
      const parent = d.transactions.find((x) => x.id === input.parentId && x.type === "sell" && x.status === "final");
      if (!parent) throw new NotFoundError("Sale");
      const at = nowISO();
      const by = currentUser()?.user.id ?? null;
      const tid = uid("t");
      const lines = picked.map((r) => {
        const pl = parent.lines.find((l) => l.id === r.lineId);
        if (!pl) throw new NotFoundError("Sale line");
        if (r.qty + pl.returnedQty > pl.qty + 1e-9) throw new ValidationError({ lines: "over_return" });
        return { pl, qty: r.qty };
      });
      const totals = orderTotals({
        lines: lines.map(({ pl, qty }) => ({ qty, unitPrice: pl.unitPrice, taxRate: pl.taxRate, taxType: pl.taxType, discount: pl.discount ?? undefined })),
        discount: input.discount ?? undefined,
      });
      const newLines = lines.map(({ pl, qty }) => {
        const product = d.products.find((x) => x.id === pl.productId);
        pl.returnedQty = roundMoney(pl.returnedQty + qty, 4);
        if (product?.manageStock) {
          const src = pl.allocations[0] ? d.stockLots.find((l) => l.id === pl.allocations[0].lotId) : undefined;
          d.stockLots.push({
            id: uid("lot"), createdAt: at, createdBy: by, locationId: parent.locationId, variationId: pl.variationId, productId: pl.productId,
            sourceTxnId: tid, lotNo: "", qtyIn: qty, qtyRemaining: qty, unitCost: pl.unitCost, receivedAt: at,
            mfgDate: src?.mfgDate ?? null, expDate: src?.expDate ?? null,
          } as (typeof d.stockLots)[number]);
        }
        return {
          id: uid("l"), productId: pl.productId, variationId: pl.variationId, unitId: pl.unitId, qty, unitPrice: pl.unitPrice, taxId: pl.taxId,
          taxRate: pl.taxRate, taxType: pl.taxType, discount: pl.discount, subtotal: lineTotals({ qty, unitPrice: pl.unitPrice, taxRate: pl.taxRate, taxType: pl.taxType, discount: pl.discount ?? undefined }).subtotal,
          unitCost: pl.unitCost, parentLineId: pl.id,
        };
      });
      // Money back = what the customer has paid beyond the sale's new net total, minus earlier refunds.
      const earlier = d.transactions.filter((r) => r.type === "sell_return" && r.parentId === parent.id);
      const net = parent.totals.total - earlier.reduce((s, r) => s + r.totals.total, 0) - totals.total;
      const refundedBefore = earlier.reduce((s, r) => s + paymentSummary(r.totals.total, r.payments).paid, 0);
      const refund = roundMoney(Math.max(0, Math.min(totals.total, paymentSummary(parent.totals.total, parent.payments).paid - refundedBefore - Math.max(0, net))));
      const method = input.refundMethod ?? "cash";
      const payments = [];
      if (refund > 0) {
        const pid = uid("pay");
        const accountId = defaultAccountId(d, parent.locationId, method);
        payments.push({ id: pid, refNo: takeRef(d, d.settings.prefixes.sellPayment, at), amount: refund, method, accountId, paidOn: at, note: "", isReturn: false, details: {}, createdBy: by });
        if (accountId) {
          d.accountTxns.push(accountTxn.parse({ id: uid("at"), createdAt: at, createdBy: by, accountId, kind: "debit", subType: "payment", amount: refund, date: at, transactionId: tid, paymentId: pid }));
        }
      }
      const refNo = takeRef(d, d.settings.prefixes.sellReturn, at);
      d.transactions.push(transaction.parse({
        id: tid, createdAt: at, createdBy: by, type: "sell_return", status: "final", locationId: parent.locationId, contactId: parent.contactId,
        refNo, date: at, parentId: parent.id, lines: newLines, discount: input.discount ?? null, totals, payments,
        paymentStatus: refund >= totals.total ? "paid" : "due", notes: input.note ?? "",
      }));
      out = { id: tid, refNo, total: totals.total };
    });
    return out;
  },

  async remove(id: string): Promise<void> {
    await delay();
    assertCan("sell.delete");
    commit((d) => {
      const r = d.transactions.find((x) => x.id === id && x.type === "sell_return");
      if (!r) throw new NotFoundError("Return");
      const lots = d.stockLots.filter((l) => l.sourceTxnId === id);
      if (lots.some((l) => l.qtyRemaining < l.qtyIn)) throw new AppError("Returned stock has already been sold again", "stock_used");
      const parent = d.transactions.find((x) => x.id === r.parentId);
      for (const l of r.lines) {
        const pl = parent?.lines.find((x) => x.id === l.parentLineId);
        if (pl) pl.returnedQty = roundMoney(Math.max(0, pl.returnedQty - l.qty), 4);
      }
      d.stockLots = d.stockLots.filter((l) => l.sourceTxnId !== id);
      d.accountTxns = d.accountTxns.filter((a) => a.transactionId !== id);
      d.transactions = d.transactions.filter((x) => x.id !== id);
    });
  },
});
