import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { accountTxn, transaction, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary, type PaymentStatus } from "@/lib/domain/payments";
import { lineTotals, orderTotals } from "@/lib/domain/totals";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";

export type PurchaseReturnFilters = ListQuery & { locationId?: string; contactId?: string; from?: string; to?: string };
export type PurchaseReturnRow = {
  id: string; date: string; refNo: string; parentId: string | null; parentRef: string; supplierName: string; locationName: string;
  paymentStatus: PaymentStatus; total: number; due: number;
};
export type PurchaseReturnableLine = { lineId: string; name: string; boughtQty: number; returnedQty: number; unitPrice: number; inStock: number | null };
export type PurchaseReturnInput = { parentId: string; lines: { lineId: string; qty: number }[]; note?: string; refundMethod?: PaymentMethod };

export const purchaseReturnsService = {
  async list(f: PurchaseReturnFilters = {}): Promise<ListResult<PurchaseReturnRow>> {
    await delay();
    const d = getDB();
    const contacts = new Map(d.contacts.map((c) => [c.id, c.name]));
    const parents = new Map(d.transactions.filter((t) => t.type === "purchase").map((t) => [t.id, t.refNo]));
    const rows = d.transactions
      .filter((t) => t.type === "purchase_return")
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.contactId || t.contactId === f.contactId)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, parents.get(t.parentId ?? ""), contacts.get(t.contactId ?? "")))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): PurchaseReturnRow => ({
        id: t.id, date: t.date, refNo: t.refNo, parentId: t.parentId, parentRef: parents.get(t.parentId ?? "") ?? "", supplierName: contacts.get(t.contactId ?? "") ?? "",
        locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", paymentStatus: t.paymentStatus, total: t.totals.total, due: paymentSummary(t.totals.total, t.payments).due,
      }));
    return paginate(rows, f);
  },

  /** Lines of a received purchase with how many can still go back: bounded by what was bought and by what is still in its lot. */
  async parentLines(purchaseId: string): Promise<PurchaseReturnableLine[]> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === purchaseId && x.type === "purchase" && x.status === "received");
    if (!t) throw new NotFoundError("Purchase");
    return t.lines.map((l) => {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      const lot = d.stockLots.find((x) => x.sourceTxnId === t.id && x.variationId === l.variationId);
      return {
        lineId: l.id, name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId, boughtQty: l.qty, returnedQty: l.returnedQty,
        unitPrice: l.unitPrice, inStock: p?.manageStock ? (lot?.qtyRemaining ?? 0) : null,
      };
    });
  },

  async create(input: PurchaseReturnInput): Promise<{ id: string; refNo: string; total: number }> {
    await delay();
    assertCan("purchase.update");
    const picked = input.lines.filter((l) => l.qty > 0);
    if (!picked.length || picked.length !== input.lines.length) throw new ValidationError({ lines: "required" });
    let out!: { id: string; refNo: string; total: number };
    commit((d) => {
      const parent = d.transactions.find((x) => x.id === input.parentId && x.type === "purchase" && x.status === "received");
      if (!parent) throw new NotFoundError("Purchase");
      const at = nowISO();
      const by = currentUser()?.user.id ?? null;
      const tid = uid("t");
      const lines = picked.map((r) => {
        const pl = parent.lines.find((l) => l.id === r.lineId);
        if (!pl) throw new NotFoundError("Purchase line");
        if (r.qty + pl.returnedQty > pl.qty + 1e-9) throw new ValidationError({ lines: "over_return" });
        const lot = d.stockLots.find((x) => x.sourceTxnId === parent.id && x.variationId === pl.variationId);
        if (d.products.find((p) => p.id === pl.productId)?.manageStock && (!lot || r.qty > lot.qtyRemaining + 1e-9)) throw new ValidationError({ lines: "over_stock" });
        return { pl, lot, qty: r.qty };
      });
      const totals = orderTotals({ lines: lines.map(({ pl, qty }) => ({ qty, unitPrice: pl.unitPrice, taxRate: pl.taxRate, taxType: "exclusive", discount: pl.discount ?? undefined })) });
      const newLines = lines.map(({ pl, lot, qty }) => {
        pl.returnedQty = roundMoney(pl.returnedQty + qty, 4);
        if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining - qty, 4);
        return {
          id: uid("l"), productId: pl.productId, variationId: pl.variationId, unitId: pl.unitId, qty, unitPrice: pl.unitPrice, taxId: pl.taxId, taxRate: pl.taxRate, taxType: "exclusive" as const,
          discount: pl.discount, subtotal: lineTotals({ qty, unitPrice: pl.unitPrice, taxRate: pl.taxRate, taxType: "exclusive", discount: pl.discount ?? undefined }).subtotal, unitCost: pl.unitCost, parentLineId: pl.id,
        };
      });
      // Money back from the supplier = what we've paid beyond the purchase's new net total, minus earlier refunds.
      const earlier = d.transactions.filter((r) => r.type === "purchase_return" && r.parentId === parent.id);
      const net = parent.totals.total - earlier.reduce((s, r) => s + r.totals.total, 0) - totals.total;
      const refundedBefore = earlier.reduce((s, r) => s + paymentSummary(r.totals.total, r.payments).paid, 0);
      const refund = roundMoney(Math.max(0, Math.min(totals.total, paymentSummary(parent.totals.total, parent.payments).paid - refundedBefore - Math.max(0, net))));
      const payments = [];
      if (refund > 0) {
        const method = input.refundMethod ?? "cash";
        const pid = uid("pay");
        const accountId = d.locations.find((l) => l.id === parent.locationId)?.defaultAccounts[method] ?? null;
        payments.push({ id: pid, refNo: takeRef(d, d.settings.prefixes.purchasePayment, at), amount: refund, method, accountId, paidOn: at, note: "", isReturn: false, details: {}, createdBy: by });
        if (accountId) d.accountTxns.push(accountTxn.parse({ id: uid("at"), createdAt: at, createdBy: by, accountId, kind: "credit", subType: "payment", amount: refund, date: at, transactionId: tid, paymentId: pid }));
      }
      const refNo = takeRef(d, d.settings.prefixes.purchaseReturn, at);
      d.transactions.push(transaction.parse({
        id: tid, createdAt: at, createdBy: by, type: "purchase_return", status: "final", locationId: parent.locationId, contactId: parent.contactId, refNo, date: at, parentId: parent.id,
        lines: newLines, totals, payments, paymentStatus: refund >= totals.total ? "paid" : "due", notes: input.note ?? "",
      }));
      out = { id: tid, refNo, total: totals.total };
    });
    return out;
  },

  /** Puts the returned stock back in the purchase's lot. */
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("purchase.delete");
    commit((d) => {
      const r = d.transactions.find((x) => x.id === id && x.type === "purchase_return");
      if (!r) throw new NotFoundError("Return");
      const parent = d.transactions.find((x) => x.id === r.parentId);
      if (!parent) throw new AppError("The purchase is gone", "not_found");
      for (const l of r.lines) {
        const pl = parent.lines.find((x) => x.id === l.parentLineId);
        if (pl) pl.returnedQty = roundMoney(Math.max(0, pl.returnedQty - l.qty), 4);
        const lot = d.stockLots.find((x) => x.sourceTxnId === parent.id && x.variationId === l.variationId);
        if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining + l.qty, 4);
      }
      d.accountTxns = d.accountTxns.filter((a) => a.transactionId !== id);
      d.transactions = d.transactions.filter((x) => x.id !== id);
    });
  },
};
