import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import {
  AppError, CreditLimitError, InsufficientStockError, NotFoundError, ProductUnavailableError, SerialsRequiredError, ValidationError,
} from "@/lib/data/errors";
import { accountTxn, transaction, type ShippingStatus, type DB, type InvoiceLayout, type Location, type Payment, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { todayISO } from "@/lib/dates";
import { effectivePaymentStatus, paymentStatus, paymentSummary, type PaymentStatus, type PayTerm } from "@/lib/domain/payments";
import { nextInvoiceNo } from "@/lib/domain/refs";
import { isValidRedeem, maxRedeemable, pointsEarned, reservedPoints } from "@/lib/domain/rewards";
import { allocate, available } from "@/lib/domain/stock";
import { emptyCart, WALK_IN_ID, type Cart, type CartLine } from "@/lib/pos/cart";
import { cartTotals, paymentState } from "@/lib/pos/selectors";
import { linkLines, syncOrders } from "./_orders";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";
import { defaultAccountId } from "./_ledger";

export type SaleStatus = "final" | "draft" | "quotation" | "suspended";
export type CheckoutPayment = { method: PaymentMethod; amount: number; details?: Payment["details"]; note?: string };
export type CheckoutInput = { cart: Cart; locationId: string; status: SaleStatus; payments?: CheckoutPayment[]; staffNote?: string };
export type SaleInput = Omit<CheckoutInput, "status"> & {
  status: SaleStatus | "proforma"; id?: string; refNo?: string; payTerm?: PayTerm | null; shipping?: Partial<Transaction["shipping"]>;
  additionalExpenses?: { name: string; amount: number }[]; salesOrderIds?: string[]; recurring?: Transaction["recurring"];
  commissionAgentId?: string | null; documents?: string[]; invoiceSchemeId?: string | null; channel?: "pos" | "web";
};
export type CheckoutResult = { id: string; refNo: string; status: SaleStatus | "proforma"; total: number; paid: number; change: number; due: number };
export type SaleRow = { id: string; refNo: string; date: string; status: SaleStatus; contactName: string; itemsCount: number; total: number; note: string };
export type ReceiptLine = { name: string; sku: string; unitName: string; qty: number; unitPrice: number; discount: number; subtotal: number; serials: string[] };
export type ReceiptData = {
  txn: Transaction;
  location: Location;
  layout: InvoiceLayout;
  a4Layout: InvoiceLayout;
  businessName: string;
  logo: string | null;
  customer: { name: string; mobile: string; isWalkIn: boolean };
  cashier: string;
  lines: ReceiptLine[];
  paid: number;
  change: number;
  due: number;
};


export type SaleFilters = ListQuery & {
  kind?: "all" | "drafts" | "quotations"; locationId?: string; contactId?: string; paymentStatus?: PaymentStatus; from?: string; to?: string;
  createdBy?: string; agentId?: string; shippingStatus?: ShippingStatus; subscription?: boolean; channel?: "pos" | "web"; deliveryPersonId?: string; shipped?: boolean;
};
export type SaleListRow = {
  id: string; refNo: string; date: string; status: Transaction["status"]; contactName: string; mobile: string; locationName: string;
  paymentStatus: PaymentStatus; methods: PaymentMethod[]; total: number; paid: number; due: number; returnDue: number;
  shippingStatus: ShippingStatus | null; deliveryPerson: string; itemsCount: number; addedBy: string; note: string; staffNote: string; recurring: boolean; channel: "pos" | "web";
};
export type SaleDetail = Transaction & { contactName: string; locationName: string; addedBy: string; lineNames: Record<string, string> };

const EDITABLE: Transaction["status"][] = ["draft", "quotation", "suspended"];

/** Outstanding amount on a customer's final sells, plus opening balance. */
function customerDue(d: DB, contactId: string): number {
  const c = d.contacts.find((x) => x.id === contactId);
  const sells = d.transactions.filter((t) => t.type === "sell" && t.status === "final" && t.contactId === contactId);
  return roundMoney(sells.reduce((s, t) => s + paymentSummary(t.totals.total, t.payments).due, c?.openingBalance ?? 0));
}

function lineAllocation(d: DB, line: CartLine, locationId: string, name: string) {
  const res = allocate(d.stockLots, {
    variationId: line.variationId, locationId, qty: line.qty,
    method: d.settings.business.accountingMethod, allowOverselling: d.settings.sale.allowOverselling,
  });
  if (res.shortfall > 0) throw new InsufficientStockError(name, available(d.stockLots, line.variationId, locationId));
  for (const a of res.allocations) {
    const lot = d.stockLots.find((l) => l.id === a.lotId);
    if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining - a.qty, 4);
  }
  return { allocations: res.allocations, unitCost: roundMoney(res.cost / line.qty) };
}

function txnToCart(d: DB, t: Transaction): Cart {
  const stockOf = (vid: string) => available(d.stockLots, vid, t.locationId);
  return {
    ...emptyCart(),
    contactId: t.contactId ?? WALK_IN_ID,
    discount: t.discount,
    orderTaxId: t.orderTaxId,
    orderTaxRate: t.orderTaxRate,
    shipping: { zone: t.shipping.zone, charges: t.shipping.charges, details: t.shipping.details, address: t.shipping.address },
    technicianId: t.technicianId,
    invoiceLayoutId: t.invoiceLayoutId,
    pointsRedeemed: t.pointsRedeemed,
    resumedFromId: t.id,
    note: t.notes,
    lines: t.lines.map((l) => {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      const u = d.units.find((x) => x.id === l.unitId);
      return {
        key: uid("k"), productId: l.productId, variationId: l.variationId,
        name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId,
        sku: v?.sku ?? "", unitId: l.unitId, unitName: u?.shortName ?? "", allowDecimal: u?.allowDecimal ?? false,
        qty: l.qty, unitPrice: l.unitPrice, taxId: l.taxId, taxRate: l.taxRate, taxType: l.taxType, discount: l.discount,
        note: l.note, serials: l.serials, serviceStaffId: l.serviceStaffId, enableSerial: p?.enableSerial ?? false,
        maxQty: p?.manageStock ? stockOf(l.variationId) : null,
      };
    }),
  };
}

/** Validates, allocates stock and writes one sell (any status). `prev` is the already-reverted original when editing. */
function writeSale(d: DB, input: SaleInput, prev?: Transaction): CheckoutResult {
  const { cart, locationId, status } = input;
  const s = d.settings;
  const at = cart.date ?? nowISO(); // sale date (may be back-dated)
  const paidAt = nowISO(); // cash moves now, so it lands in the open register
  const by = currentUser()?.user.id ?? null;
  const location = d.locations.find((l) => l.id === locationId);
  if (!location) throw new NotFoundError("Location");
  const contact = d.contacts.find((c) => c.id === cart.contactId);
  if (!contact) throw new NotFoundError("Contact");
  const isWalkIn = contact.id === WALK_IN_ID || contact.isDefault;

  const totals = cartTotals(cart, { rounding: s.sale.roundingMethod, rewards: s.rewards, additional: (input.additionalExpenses ?? []).map((e) => e.amount) });
  const tid = prev?.id ?? uid("t");

  const built = cart.lines.map((l, i) => {
    const p = d.products.find((x) => x.id === l.productId);
    if (!p || !p.active || p.notForSale || !p.locationIds.includes(locationId)) throw new ProductUnavailableError(l.name);
    let allocations: { lotId: string; qty: number; unitCost: number }[] = [];
    let unitCost = d.variations.find((v) => v.id === l.variationId)?.purchasePriceExc ?? 0;
    if (status === "final") {
      if (p.enableSerial && l.serials.length !== l.qty) throw new SerialsRequiredError(l.name, l.qty);
      if (p.manageStock) ({ allocations, unitCost } = lineAllocation(d, l, locationId, l.name));
    }
    return {
      id: uid("l"), productId: l.productId, variationId: l.variationId, unitId: l.unitId, qty: l.qty, unitPrice: l.unitPrice,
      taxId: l.taxId, taxRate: l.taxRate, taxType: l.taxType, discount: l.discount, subtotal: totals.lines[i].subtotal,
      unitCost, allocations, note: l.note, serials: l.serials, serviceStaffId: l.serviceStaffId,
    };
  });

  const lines = linkLines(d, input.salesOrderIds ?? [], built);

  if (cart.pointsRedeemed > 0) {
    const balance = contact.points - reservedPoints(d.transactions, contact.id, tid);
    const cap = isWalkIn ? 0 : maxRedeemable({ total: totals.total + totals.redeemed, balance, s: s.rewards });
    if (!isValidRedeem(cart.pointsRedeemed, cap, s.rewards)) throw new ValidationError({ pointsRedeemed: "invalid" });
  }

  const payments: Payment[] = [];
  let paid = 0;
  let change = 0;
  if (status === "final") {
    const rows = (input.payments ?? []).filter((r) => r.amount > 0).map((r) => ({ ...r, amount: roundMoney(r.amount) }));
    const st = paymentState(totals.total, rows);
    if (st.nonCashOverpaid) throw new ValidationError({ payments: "non_cash_overpaid" });
    const mkPayment = (method: PaymentMethod, amount: number, isReturn: boolean, details: Payment["details"] = {}, note = "") => {
      const pid = uid("pay");
      const accountId = defaultAccountId(d, location.id, method);
      payments.push({ id: pid, refNo: takeRef(d, s.prefixes.sellPayment, at), amount, method, accountId, paidOn: paidAt, note, isReturn, details, createdBy: by });
      if (accountId) {
        d.accountTxns.push(accountTxn.parse({
          id: uid("at"), createdAt: paidAt, createdBy: by, accountId, kind: isReturn ? "debit" : "credit", subType: "payment",
          amount, date: paidAt, transactionId: tid, paymentId: pid,
        }));
      }
    };
    for (const r of rows) mkPayment(r.method, r.amount, false, r.details, r.note);
    if (st.change > 0) mkPayment("cash", st.change, true);
    paid = st.paid;
    change = st.change;
    const due = roundMoney(Math.max(0, totals.total - paid));
    if (due > 0 && isWalkIn) throw new AppError("Choose a named customer for a credit sale", "walk_in_credit");
    if (due > 0 && contact.creditLimit != null && customerDue(d, contact.id) + due > contact.creditLimit) throw new CreditLimitError();
  }

  let refNo: string;
  let invoiceSchemeId: string | null = null;
  if (status === "final") {
    if (prev?.status === "final") {
      refNo = prev.refNo;
      invoiceSchemeId = prev.invoiceSchemeId;
    } else if (input.refNo) {
      if (d.transactions.some((x) => x.type === "sell" && x.refNo === input.refNo)) throw new AppError("Invoice number already used", "duplicate_ref");
      refNo = input.refNo;
    } else {
      const scheme = d.invoiceSchemes.find((x) => x.id === (input.invoiceSchemeId ?? location.invoiceSchemeId));
      if (!scheme) throw new NotFoundError("Invoice scheme");
      refNo = nextInvoiceNo(scheme);
      scheme.count += 1;
      invoiceSchemeId = scheme.id;
    }
  } else {
    refNo = prev && prev.status !== "final" ? prev.refNo : takeRef(d, s.prefixes.draft, at);
  }

  const earned = status === "final" && !isWalkIn ? pointsEarned(totals.total, s.rewards) : 0;
  if (status === "final" && !isWalkIn) contact.points = Math.max(0, contact.points - cart.pointsRedeemed + earned);

  if (cart.resumedFromId) {
    const i = d.transactions.findIndex((t) => t.id === cart.resumedFromId && t.type === "sell" && EDITABLE.includes(t.status));
    if (i < 0) throw new NotFoundError("Sale");
    d.transactions.splice(i, 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lines: _l, ...orderTotals } = totals;
  d.transactions.push(transaction.parse({
    id: tid, createdAt: prev?.createdAt ?? nowISO(), createdBy: prev?.createdBy ?? by, type: "sell", status, channel: prev?.channel ?? input.channel ?? "pos", locationId, contactId: contact.id, refNo, date: at,
    lines, discount: cart.discount, orderTaxId: cart.orderTaxId, orderTaxRate: cart.orderTaxRate,
    pointsRedeemed: cart.pointsRedeemed, pointsEarned: earned,
    shipping: {
      zone: cart.shipping.zone, charges: cart.shipping.charges, details: cart.shipping.details, address: cart.shipping.address,
      status: status === "final" && cart.shipping.zone ? "ordered" : null,
      ...input.shipping,
    },
    additionalExpenses: input.additionalExpenses ?? [], salesOrderIds: input.salesOrderIds ?? [], recurring: input.recurring ?? null,
    commissionAgentId: input.commissionAgentId ?? null, documents: input.documents ?? [],
    totals: orderTotals, payments,
    paymentStatus: status === "final" ? paymentStatus({ total: totals.total, paid, date: at, payTerm: input.payTerm === undefined ? contact.payTerm : input.payTerm }) : "due",
    payTerm: input.payTerm === undefined ? contact.payTerm : input.payTerm, notes: cart.note, staffNote: input.staffNote ?? "", invoiceSchemeId,
    invoiceLayoutId: cart.invoiceLayoutId, technicianId: cart.technicianId,
  }));

  syncOrders(d, input.salesOrderIds ?? []);
  return { id: tid, refNo, status, total: totals.total, paid, change, due: roundMoney(Math.max(0, totals.total - paid)) };
}

/** Undo a sell's side effects (stock, ledger, points) and remove it. Drafts and quotations have none of these. */
export function revertSale(d: DB, t: Transaction) {
  if (d.transactions.some((r) => r.type === "sell_return" && r.parentId === t.id)) throw new AppError("This sale has returns; delete them first", "has_returns");
  if (t.status === "final") {
    for (const l of t.lines) {
      for (const a of l.allocations) {
        const lot = d.stockLots.find((x) => x.id === a.lotId);
        if (lot) lot.qtyRemaining = roundMoney(lot.qtyRemaining + a.qty, 4);
      }
    }
    const c = d.contacts.find((x) => x.id === t.contactId);
    if (c && !c.isDefault && c.id !== WALK_IN_ID) c.points = Math.max(0, c.points + t.pointsRedeemed - t.pointsEarned);
  }
  d.accountTxns = d.accountTxns.filter((a) => a.transactionId !== t.id);
  d.transactions = d.transactions.filter((x) => x.id !== t.id);
  syncOrders(d, t.salesOrderIds);
}

export const salesService = {
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    await delay();
    assertCan("sell.create");
    if (!input.cart.lines.length) throw new AppError("Add at least one item", "empty_cart");
    let result!: CheckoutResult;
    commit((d) => {
      result = writeSale(d, input);
    });
    return result;
  },

  async toCart(id: string, anyStatus = false): Promise<Cart> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "sell" && (anyStatus ? x.status !== "suspended" : EDITABLE.includes(x.status)));
    if (!t) throw new NotFoundError("Sale");
    return txnToCart(d, t);
  },

  async list(q: { locationId: string; status: SaleStatus; limit?: number; channel?: "pos" | "web" }): Promise<SaleRow[]> {
    await delay();
    const d = getDB();
    const names = new Map(d.contacts.map((c) => [c.id, c.name]));
    return d.transactions
      .filter((t) => t.type === "sell" && t.locationId === q.locationId && t.status === q.status && (!q.channel || t.channel === q.channel))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, q.limit ?? 10)
      .map((t) => ({
        id: t.id, refNo: t.refNo, date: t.date, status: t.status as SaleStatus, contactName: names.get(t.contactId ?? "") ?? "",
        itemsCount: t.totals.itemsCount, total: t.totals.total, note: t.staffNote || t.notes,
      }));
  },

  async listAll(f: SaleFilters = {}): Promise<ListResult<SaleListRow> & { totals: { total: number; paid: number; due: number } }> {
    await delay();
    const d = getDB();
    const contacts = new Map(d.contacts.map((c) => [c.id, c]));
    const locations = new Map(d.locations.map((l) => [l.id, l.name]));
    const users = new Map(d.users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const kindStatus = f.kind === "drafts" ? ["draft"] : f.kind === "quotations" ? ["quotation"] : null;
    const today = todayISO(d.settings.business.timeZone);
    // A final invoice's stored status is fixed at save time; its pay term may have passed since.
    const statusOf = (t: Transaction): PaymentStatus => (t.status === "final" ? effectivePaymentStatus(t, today) : t.paymentStatus);
    const rows = d.transactions
      .filter((t) => t.type === "sell" && t.status !== "suspended")
      .filter((t) => !kindStatus || kindStatus.includes(t.status))
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.contactId || t.contactId === f.contactId)
      .filter((t) => !f.createdBy || t.createdBy === f.createdBy)
      .filter((t) => !f.agentId || t.commissionAgentId === f.agentId)
      .filter((t) => !f.channel || t.channel === f.channel)
      .filter((t) => !f.shippingStatus || t.shipping.status === f.shippingStatus)
      .filter((t) => !f.subscription || t.recurring != null)
      .filter((t) => !f.deliveryPersonId || t.shipping.deliveryPersonId === f.deliveryPersonId)
      .filter((t) => !f.shipped || t.shipping.status != null)
      .filter((t) => !f.paymentStatus || statusOf(t) === f.paymentStatus)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, contacts.get(t.contactId ?? "")?.name, contacts.get(t.contactId ?? "")?.mobile))
      .sort((a, b) => b.date.localeCompare(a.date));
    const toRow = (t: Transaction): SaleListRow => {
      const c = contacts.get(t.contactId ?? "");
      const sum = paymentSummary(t.totals.total, t.payments);
      const returnDue = roundMoney(
        d.transactions.filter((r) => r.type === "sell_return" && r.parentId === t.id)
          .reduce((s, r) => s + paymentSummary(r.totals.total, r.payments).due, 0),
      );
      return {
        id: t.id, refNo: t.refNo, date: t.date, status: t.status, contactName: c?.name ?? "", mobile: c?.mobile ?? "",
        locationName: locations.get(t.locationId) ?? "", paymentStatus: statusOf(t),
        methods: [...new Set(t.payments.filter((p) => !p.isReturn).map((p) => p.method))], total: t.totals.total, paid: sum.paid,
        due: t.status === "final" ? sum.due : 0, returnDue, shippingStatus: t.shipping.status, deliveryPerson: users.get(t.shipping.deliveryPersonId ?? "") ?? "", itemsCount: t.totals.itemsCount,
        addedBy: users.get(t.createdBy ?? "") ?? "", note: t.notes, staffNote: t.staffNote, recurring: t.recurring != null, channel: t.channel,
      };
    };
    const all = rows.map(toRow);
    const totals = {
      total: roundMoney(all.reduce((s, r) => s + r.total, 0)),
      paid: roundMoney(all.reduce((s, r) => s + r.paid, 0)),
      due: roundMoney(all.reduce((s, r) => s + r.due, 0)),
    };
    return { ...paginate(all, f), totals };
  },

  async get(id: string): Promise<SaleDetail> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "sell");
    if (!t) throw new NotFoundError("Sale");
    const user = d.users.find((u) => u.id === t.createdBy);
    const lineNames: Record<string, string> = {};
    for (const l of t.lines) {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      lineNames[l.id] = p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId;
    }
    return {
      ...t, contactName: d.contacts.find((c) => c.id === t.contactId)?.name ?? "",
      locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "",
      addedBy: user ? `${user.firstName} ${user.lastName}`.trim() : "", lineNames,
    };
  },

  async save(input: SaleInput): Promise<CheckoutResult> {
    await delay();
    assertCan(input.id ? "sell.update" : "sell.create");
    if (!input.cart.lines.length) throw new AppError("Add at least one item", "empty_cart");
    if ((input.additionalExpenses ?? []).length > 4) throw new ValidationError({ additionalExpenses: "max_4" });
    let result!: CheckoutResult;
    commit((d) => {
      let prev: Transaction | undefined;
      let payments = input.payments;
      if (input.id) {
        prev = d.transactions.find((t) => t.id === input.id && t.type === "sell" && t.status !== "suspended");
        if (!prev) throw new NotFoundError("Sale");
        payments ??= prev.payments.filter((p) => !p.isReturn).map((p) => ({ method: p.method, amount: p.amount, details: p.details, note: p.note }));
        revertSale(d, prev);
      }
      result = writeSale(d, { ...input, payments }, prev);
    });
    return result;
  },

  async convert(id: string, payments: CheckoutPayment[] = []): Promise<CheckoutResult> {
    await delay();
    assertCan("sell.update");
    let result!: CheckoutResult;
    commit((d) => {
      const prev = d.transactions.find((t) => t.id === id && t.type === "sell" && ["draft", "quotation", "proforma"].includes(t.status));
      if (!prev) throw new NotFoundError("Sale");
      const cart = txnToCart(d, prev);
      revertSale(d, prev);
      result = writeSale(d, {
        cart: { ...cart, resumedFromId: null }, locationId: prev.locationId, status: "final", payments, payTerm: prev.payTerm,
        shipping: prev.shipping, additionalExpenses: prev.additionalExpenses, salesOrderIds: prev.salesOrderIds,
        recurring: prev.recurring, commissionAgentId: prev.commissionAgentId, documents: prev.documents, staffNote: prev.staffNote,
      }, prev);
    });
    return result;
  },

  /** Next invoice of a subscription: same lines and customer, dated now, unpaid. */
  async generateNext(id: string): Promise<CheckoutResult> {
    await delay();
    assertCan("sell.create");
    let result!: CheckoutResult;
    commit((d) => {
      const src = d.transactions.find((t) => t.id === id && t.type === "sell" && t.status === "final");
      if (!src?.recurring) throw new NotFoundError("Subscription");
      result = writeSale(d, {
        cart: { ...txnToCart(d, src), resumedFromId: null, date: null, pointsRedeemed: 0 }, locationId: src.locationId, status: "final", payments: [],
        payTerm: src.payTerm, shipping: { ...src.shipping, status: src.shipping.zone ? "ordered" : null }, additionalExpenses: src.additionalExpenses,
        commissionAgentId: src.commissionAgentId, recurring: { ...src.recurring, parentId: src.recurring.parentId ?? src.id }, channel: src.channel,
      });
    });
    return result;
  },

  async removeAny(id: string): Promise<void> {
    await delay();
    assertCan("sell.delete");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "sell");
      if (!t) throw new NotFoundError("Sale");
      revertSale(d, t);
    });
  },

  async addPayment(id: string, p: CheckoutPayment & { paidOn?: string }): Promise<void> {
    await delay();
    assertCan("sell.payments");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "sell");
      if (!t) throw new NotFoundError("Sale");
      if (t.status !== "final") throw new AppError("Only final sales take payments", "not_final");
      const amount = roundMoney(p.amount);
      const due = paymentSummary(t.totals.total, t.payments).due;
      if (amount <= 0 || amount > due) throw new ValidationError({ amount: "invalid" });
      const by = currentUser()?.user.id ?? null;
      const paidOn = p.paidOn ?? nowISO();
      const accountId = defaultAccountId(d, t.locationId, p.method);
      const pid = uid("pay");
      t.payments.push({ id: pid, refNo: takeRef(d, d.settings.prefixes.sellPayment, paidOn), amount, method: p.method, accountId, paidOn, note: p.note ?? "", isReturn: false, details: p.details ?? {}, createdBy: by });
      if (accountId) {
        d.accountTxns.push(accountTxn.parse({ id: uid("at"), createdAt: nowISO(), createdBy: by, accountId, kind: "credit", subType: "payment", amount, date: paidOn, transactionId: t.id, paymentId: pid }));
      }
      t.paymentStatus = paymentStatus({ total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, date: t.date, payTerm: t.payTerm });
    });
  },

  async removePayment(id: string, paymentId: string): Promise<void> {
    await delay();
    assertCan("sell.payments");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "sell");
      const pay = t?.payments.find((x) => x.id === paymentId);
      if (!t || !pay) throw new NotFoundError("Payment");
      t.payments = t.payments.filter((x) => x.id !== paymentId);
      d.accountTxns = d.accountTxns.filter((a) => a.paymentId !== paymentId);
      t.paymentStatus = paymentStatus({ total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, date: t.date, payTerm: t.payTerm });
    });
  },

  async setShipping(id: string, patch: Partial<Pick<Transaction["shipping"], "status" | "deliveredTo" | "deliveryPersonId" | "details" | "address" | "charges">>): Promise<void> {
    await delay();
    assertCan("sell.update");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === id && x.type === "sell");
      if (!t) throw new NotFoundError("Sale");
      t.shipping = { ...t.shipping, ...patch };
    });
  },

  async receipt(id: string): Promise<ReceiptData> {
    await delay();
    const d = getDB();
    const txn = d.transactions.find((t) => t.id === id);
    if (!txn) throw new NotFoundError("Sale");
    const location = d.locations.find((l) => l.id === txn.locationId)!;
    const layoutById = (lid: string | null) => d.invoiceLayouts.find((x) => x.id === lid);
    const layout = layoutById(txn.invoiceLayoutId) ?? layoutById(location.posLayoutId) ?? d.invoiceLayouts[0];
    const a4Layout = layoutById(location.saleLayoutId) ?? d.invoiceLayouts.find((x) => x.paper === "a4") ?? layout;
    const contact = d.contacts.find((c) => c.id === txn.contactId);
    const user = d.users.find((u) => u.id === txn.createdBy);
    const sum = paymentSummary(txn.totals.total, txn.payments);
    const change = roundMoney(txn.payments.filter((p) => p.isReturn).reduce((s, p) => s + p.amount, 0));
    return {
      txn, location, layout, a4Layout,
      businessName: d.settings.business.name,
      logo: d.settings.business.logo,
      customer: { name: contact?.name ?? "", mobile: contact?.mobile ?? "", isWalkIn: !contact || contact.isDefault },
      cashier: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      lines: txn.lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        const v = d.variations.find((x) => x.id === l.variationId);
        const discountPerUnit = l.qty ? roundMoney((l.unitPrice * l.qty * (1 + (l.taxType === "exclusive" ? l.taxRate / 100 : 0)) - l.subtotal) / l.qty) : 0;
        return {
          name: p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : "",
          sku: v?.sku ?? "", unitName: d.units.find((u) => u.id === l.unitId)?.shortName ?? "",
          qty: l.qty, unitPrice: l.qty ? roundMoney(l.subtotal / l.qty + discountPerUnit) : 0, discount: discountPerUnit,
          subtotal: l.subtotal, serials: l.serials,
        };
      }),
      paid: sum.paid, change, due: sum.due,
    };
  },

  async remove(id: string): Promise<void> {
    await delay();
    assertCan("sell.delete");
    commit((d) => {
      const i = d.transactions.findIndex((t) => t.id === id);
      if (i < 0) throw new NotFoundError("Sale");
      if (!EDITABLE.includes(d.transactions[i].status)) throw new AppError("Final sales can't be deleted here", "not_deletable");
      d.transactions.splice(i, 1);
    });
  },
};
