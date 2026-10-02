import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { accountTxn, stockLot, transaction, type DB, type Payment, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentStatus, paymentSummary, type PaymentStatus, type PayTerm } from "@/lib/domain/payments";
import { marginFromPrices } from "@/lib/domain/pricing";
import { lineTotals, orderTotals, type DiscountInput } from "@/lib/domain/totals";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";

export type PurchaseStatus = "received" | "pending" | "ordered";
export type PurchaseLineInput = {
  productId: string; variationId: string; qty: number;
  /** Unit cost excluding tax, before the line discount. */
  unitPrice: number;
  discount: DiscountInput | null;
  taxId: string | null;
  lotNo?: string; mfgDate?: string | null; expDate?: string | null;
  /** When set (and the purchase is received), becomes the variation's selling price. */
  sellPriceInc?: number | null;
};
export type PurchasePaymentInput = { method: PaymentMethod; amount: number; note?: string; paidOn?: string; details?: Payment["details"] };
export type PurchaseInput = {
  id?: string; locationId: string; contactId: string; date: string; status: PurchaseStatus; refNo?: string;
  lines: PurchaseLineInput[]; discount: DiscountInput | null; orderTaxId: string | null;
  shipping: { charges: number; details: string }; additionalExpenses: { name: string; amount: number }[];
  exchangeRate: number; payTerm: PayTerm | null; notes: string; documents: string[];
  /** New purchases only: paid up front. Later payments go through `addPayment`. */
  payments?: PurchasePaymentInput[];
};

export type PurchaseFilters = ListQuery & { locationId?: string; contactId?: string; status?: PurchaseStatus; paymentStatus?: PaymentStatus; from?: string; to?: string };
export type PurchaseRow = {
  id: string; date: string; refNo: string; locationName: string; supplierName: string; status: PurchaseStatus; paymentStatus: PaymentStatus;
  total: number; paid: number; due: number; addedBy: string;
};
export type PurchaseDetail = Transaction & {
  supplierName: string; locationName: string; paid: number; due: number; addedBy: string;
  lineNames: Record<string, { name: string; sku: string; unitName: string }>; returns: Transaction[];
};

const MAX_EXTRA = 4;

/** Makes the lots of a purchase match its state: only a received purchase has them, one per variation. */
function syncLots(d: DB, t: Transaction) {
  const lots = d.stockLots.filter((l) => l.sourceTxnId === t.id);
  const want = t.status === "received" ? t.lines : [];
  const keep = new Set<string>();
  for (const l of want) {
    const lot = lots.find((x) => x.variationId === l.variationId);
    if (lot) {
      const used = roundMoney(lot.qtyIn - lot.qtyRemaining, 4);
      if (l.qty < used) throw new ValidationError({ lines: "below_sold" });
      if (lot.locationId !== t.locationId && used > 0) throw new ValidationError({ locationId: "location_locked" });
      Object.assign(lot, { locationId: t.locationId, qtyIn: l.qty, qtyRemaining: roundMoney(l.qty - used, 4), unitCost: l.unitCost, lotNo: l.lotNo, mfgDate: l.mfgDate, expDate: l.expDate, receivedAt: t.date });
      keep.add(lot.id);
    } else {
      const id = uid("lot");
      d.stockLots.push(stockLot.parse({
        id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, locationId: t.locationId, variationId: l.variationId, productId: l.productId,
        sourceTxnId: t.id, lotNo: l.lotNo, qtyIn: l.qty, qtyRemaining: l.qty, unitCost: l.unitCost, receivedAt: t.date, mfgDate: l.mfgDate, expDate: l.expDate,
      }));
      keep.add(id);
    }
  }
  for (const lot of lots.filter((x) => !keep.has(x.id))) {
    if (lot.qtyRemaining < lot.qtyIn) throw new ValidationError({ lines: "below_sold" });
  }
  d.stockLots = d.stockLots.filter((l) => l.sourceTxnId !== t.id || keep.has(l.id));
  if (t.status === "received") {
    for (const l of t.lines) {
      const p = d.products.find((x) => x.id === l.productId);
      if (p && !p.locationIds.includes(t.locationId)) p.locationIds.push(t.locationId);
    }
  }
}

function applySellPrices(d: DB, t: Transaction) {
  if (t.status !== "received") return;
  for (const l of t.lines) {
    if (l.sellPriceInc == null) continue;
    const v = d.variations.find((x) => x.id === l.variationId);
    if (!v) continue;
    const rate = d.taxRates.find((x) => x.id === d.products.find((p) => p.id === l.productId)?.taxId)?.rate ?? 0;
    v.purchasePriceExc = l.unitCost;
    v.purchasePriceInc = roundMoney(l.unitCost * (1 + rate / 100));
    v.sellPriceInc = l.sellPriceInc;
    v.sellPriceExc = roundMoney(l.sellPriceInc / (1 + rate / 100));
    v.margin = marginFromPrices(l.unitCost, v.sellPriceExc);
  }
}

function addPaymentTo(d: DB, t: Transaction, p: PurchasePaymentInput) {
  const amount = roundMoney(p.amount);
  if (!(amount > 0) || amount > paymentSummary(t.totals.total, t.payments).due) throw new ValidationError({ amount: "invalid" });
  const by = currentUser()?.user.id ?? null;
  const paidOn = p.paidOn ?? nowISO();
  const accountId = d.locations.find((l) => l.id === t.locationId)?.defaultAccounts[p.method] ?? null;
  const pid = uid("pay");
  t.payments.push({ id: pid, refNo: takeRef(d, d.settings.prefixes.purchasePayment, paidOn), amount, method: p.method, accountId, paidOn, note: p.note ?? "", isReturn: false, details: p.details ?? {}, createdBy: by });
  if (accountId) d.accountTxns.push(accountTxn.parse({ id: uid("at"), createdAt: nowISO(), createdBy: by, accountId, kind: "debit", subType: "payment", amount, date: paidOn, transactionId: t.id, paymentId: pid }));
  t.paymentStatus = paymentStatus({ total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, date: t.date, payTerm: t.payTerm });
}

function writePurchase(d: DB, input: PurchaseInput): { id: string; refNo: string } {
  const prev = input.id ? d.transactions.find((x) => x.id === input.id && x.type === "purchase") : undefined;
  if (input.id && !prev) throw new NotFoundError("Purchase");
  if (prev && d.transactions.some((r) => r.type === "purchase_return" && r.parentId === prev.id)) throw new AppError("This purchase has returns; delete them first", "has_returns");
  if (!d.locations.some((l) => l.id === input.locationId)) throw new NotFoundError("Location");
  const supplier = d.contacts.find((c) => c.id === input.contactId);
  if (!supplier || supplier.type === "customer") throw new ValidationError({ contactId: "supplier_required" });
  if (!input.lines.length) throw new ValidationError({ lines: "required" });
  if (input.additionalExpenses.length > MAX_EXTRA) throw new ValidationError({ additionalExpenses: "max_4" });
  if (!(input.exchangeRate > 0)) throw new ValidationError({ exchangeRate: "invalid" });
  const seen = new Set<string>();
  for (const l of input.lines) {
    if (!(l.qty > 0)) throw new ValidationError({ lines: "qty" });
    if (!(l.unitPrice >= 0)) throw new ValidationError({ lines: "price" });
    if (seen.has(l.variationId)) throw new ValidationError({ lines: "duplicate" });
    seen.add(l.variationId);
    if (!d.variations.some((v) => v.id === l.variationId && v.productId === l.productId)) throw new NotFoundError("Product");
  }
  if (input.refNo && d.transactions.some((x) => x.type === "purchase" && x.id !== prev?.id && x.refNo === input.refNo)) throw new AppError("Reference number already used", "duplicate_ref");

  const tax = (id: string | null) => d.taxRates.find((x) => x.id === id)?.rate ?? 0;
  const calc = input.lines.map((l) => ({ l, lt: lineTotals({ qty: l.qty, unitPrice: l.unitPrice, taxRate: tax(l.taxId), taxType: "exclusive", discount: l.discount ?? undefined }) }));
  const totals = orderTotals({
    lines: calc.map(({ l }) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: tax(l.taxId), taxType: "exclusive", discount: l.discount ?? undefined })),
    discount: input.discount ?? undefined, orderTaxRate: tax(input.orderTaxId), shipping: input.shipping.charges, additionalExpenses: input.additionalExpenses.map((e) => e.amount),
  });
  const paidBefore = prev ? paymentSummary(prev.totals.total, prev.payments).paid : 0;
  if (totals.total < paidBefore) throw new ValidationError({ total: "below_paid" });

  const by = currentUser()?.user.id ?? null;
  const tid = prev?.id ?? uid("t");
  const refNo = prev?.refNo ?? input.refNo ?? takeRef(d, d.settings.prefixes.purchase, input.date);
  const lines = calc.map(({ l, lt }) => ({
    id: uid("l"), productId: l.productId, variationId: l.variationId, unitId: d.products.find((p) => p.id === l.productId)?.unitId ?? "", qty: l.qty, unitPrice: l.unitPrice,
    taxId: l.taxId, taxRate: tax(l.taxId), taxType: "exclusive" as const, discount: l.discount, subtotal: lt.subtotal, unitCost: roundMoney(lt.unitExc - lt.discountPerUnit),
    lotNo: l.lotNo ?? "", mfgDate: l.mfgDate ?? null, expDate: l.expDate ?? null, sellPriceInc: l.sellPriceInc ?? null,
  }));
  const next = transaction.parse({
    id: tid, createdAt: prev?.createdAt ?? nowISO(), createdBy: prev?.createdBy ?? by, type: "purchase", status: input.status, locationId: input.locationId, contactId: input.contactId,
    refNo, date: input.date, lines, discount: input.discount, orderTaxId: input.orderTaxId, orderTaxRate: tax(input.orderTaxId),
    shipping: { details: input.shipping.details, charges: input.shipping.charges }, additionalExpenses: input.additionalExpenses, totals,
    payments: prev?.payments ?? [], paymentStatus: "due", payTerm: input.payTerm, exchangeRate: input.exchangeRate, notes: input.notes, documents: input.documents,
  });
  next.paymentStatus = paymentStatus({ total: totals.total, paid: paidBefore, date: next.date, payTerm: next.payTerm });
  if (prev) d.transactions[d.transactions.indexOf(prev)] = next;
  else d.transactions.push(next);
  syncLots(d, next);
  applySellPrices(d, next);
  for (const p of input.payments ?? []) addPaymentTo(d, next, p);
  return { id: tid, refNo };
}

export const purchasesService = {
  async list(f: PurchaseFilters = {}): Promise<ListResult<PurchaseRow> & { totals: { total: number; paid: number; due: number } }> {
    await delay();
    const d = getDB();
    const contacts = new Map(d.contacts.map((c) => [c.id, c.name]));
    const rows = d.transactions
      .filter((t) => t.type === "purchase")
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.contactId || t.contactId === f.contactId)
      .filter((t) => !f.status || t.status === f.status)
      .filter((t) => !f.paymentStatus || t.paymentStatus === f.paymentStatus)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, contacts.get(t.contactId ?? "")))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): PurchaseRow => {
        const s = paymentSummary(t.totals.total, t.payments);
        const u = d.users.find((x) => x.id === t.createdBy);
        return {
          id: t.id, date: t.date, refNo: t.refNo, locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", supplierName: contacts.get(t.contactId ?? "") ?? "",
          status: t.status as PurchaseStatus, paymentStatus: t.paymentStatus, total: t.totals.total, paid: s.paid, due: s.due, addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "",
        };
      });
    const sum = (k: "total" | "paid" | "due") => roundMoney(rows.reduce((s, r) => s + r[k], 0));
    return { ...paginate(rows, f), totals: { total: sum("total"), paid: sum("paid"), due: sum("due") } };
  },

  async get(id: string): Promise<PurchaseDetail> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "purchase");
    if (!t) throw new NotFoundError("Purchase");
    const s = paymentSummary(t.totals.total, t.payments);
    const u = d.users.find((x) => x.id === t.createdBy);
    const lineNames: PurchaseDetail["lineNames"] = {};
    for (const l of t.lines) {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      lineNames[l.id] = {
        name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId, sku: v?.sku ?? "",
        unitName: d.units.find((x) => x.id === l.unitId)?.shortName ?? "",
      };
    }
    return {
      ...t, supplierName: d.contacts.find((c) => c.id === t.contactId)?.name ?? "", locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "",
      paid: s.paid, due: s.due, addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "", lineNames,
      returns: d.transactions.filter((r) => r.type === "purchase_return" && r.parentId === id),
    };
  },

  /** The purchase in the shape the form edits. */
  async getForm(id: string): Promise<PurchaseInput & { id: string }> {
    await delay();
    const t = getDB().transactions.find((x) => x.id === id && x.type === "purchase");
    if (!t) throw new NotFoundError("Purchase");
    return {
      id, locationId: t.locationId, contactId: t.contactId ?? "", date: t.date, status: t.status as PurchaseStatus, refNo: t.refNo,
      lines: t.lines.map((l) => ({ productId: l.productId, variationId: l.variationId, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, taxId: l.taxId, lotNo: l.lotNo, mfgDate: l.mfgDate, expDate: l.expDate, sellPriceInc: l.sellPriceInc })),
      discount: t.discount, orderTaxId: t.orderTaxId, shipping: { charges: t.shipping.charges, details: t.shipping.details }, additionalExpenses: t.additionalExpenses,
      exchangeRate: t.exchangeRate, payTerm: t.payTerm, notes: t.notes, documents: t.documents,
    };
  },

  async save(input: PurchaseInput): Promise<{ id: string; refNo: string }> {
    await delay();
    assertCan(input.id ? "purchase.update" : "purchase.create");
    if (!input.id && input.payments?.length) assertCan("purchase.payments");
    let out!: { id: string; refNo: string };
    commit((d) => void (out = writePurchase(d, input)));
    return out;
  },

  async setStatus(id: string, status: PurchaseStatus): Promise<void> {
    await delay();
    assertCan("purchase.update");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "purchase");
      if (!t) throw new NotFoundError("Purchase");
      if (d.transactions.some((r) => r.type === "purchase_return" && r.parentId === id)) throw new AppError("This purchase has returns; delete them first", "has_returns");
      t.status = status;
      syncLots(d, t);
      applySellPrices(d, t);
    });
  },

  async addPayment(id: string, p: PurchasePaymentInput): Promise<void> {
    await delay();
    assertCan("purchase.payments");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "purchase");
      if (!t) throw new NotFoundError("Purchase");
      addPaymentTo(d, t, p);
    });
  },

  async removePayment(id: string, paymentId: string): Promise<void> {
    await delay();
    assertCan("purchase.payments");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "purchase");
      if (!t || !t.payments.some((x) => x.id === paymentId)) throw new NotFoundError("Payment");
      t.payments = t.payments.filter((x) => x.id !== paymentId);
      d.accountTxns = d.accountTxns.filter((a) => a.paymentId !== paymentId);
      t.paymentStatus = paymentStatus({ total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, date: t.date, payTerm: t.payTerm });
    });
  },

  /** Deleting takes the received stock back out, so it's refused once any of it has been sold. */
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("purchase.delete");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "purchase");
      if (!t) throw new NotFoundError("Purchase");
      if (d.transactions.some((r) => r.type === "purchase_return" && r.parentId === id)) throw new AppError("This purchase has returns; delete them first", "has_returns");
      if (d.stockLots.some((l) => l.sourceTxnId === id && l.qtyRemaining < l.qtyIn)) throw new AppError("Stock from this purchase has already been sold", "stock_used");
      d.stockLots = d.stockLots.filter((l) => l.sourceTxnId !== id);
      d.accountTxns = d.accountTxns.filter((a) => a.transactionId !== id);
      d.transactions = d.transactions.filter((x) => x.id !== id);
    });
  },
};
