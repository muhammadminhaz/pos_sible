import { currentUser } from "@/lib/auth/session";
import {
  AppError, CreditLimitError, InsufficientStockError, NotFoundError, ProductUnavailableError, SerialsRequiredError, ValidationError,
} from "@/lib/data/errors";
import { accountTxn, transaction, type DB, type InvoiceLayout, type Location, type Payment, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentStatus, paymentSummary } from "@/lib/domain/payments";
import { nextInvoiceNo } from "@/lib/domain/refs";
import { maxRedeemable, pointsEarned } from "@/lib/domain/rewards";
import { allocate, available } from "@/lib/domain/stock";
import { emptyCart, WALK_IN_ID, type Cart, type CartLine } from "@/lib/pos/cart";
import { cartTotals, paymentState } from "@/lib/pos/selectors";
import { delay, nowISO, takeRef, uid } from "./_util";

export type SaleStatus = "final" | "draft" | "quotation" | "suspended";
export type CheckoutPayment = { method: PaymentMethod; amount: number; details?: Payment["details"]; note?: string };
export type CheckoutInput = { cart: Cart; locationId: string; status: SaleStatus; payments?: CheckoutPayment[]; staffNote?: string };
export type CheckoutResult = { id: string; refNo: string; status: SaleStatus; total: number; paid: number; change: number; due: number };
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

export const salesService = {
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    await delay();
    const { cart, locationId, status } = input;
    if (!cart.lines.length) throw new AppError("Add at least one item", "empty_cart");
    let result!: CheckoutResult;

    commit((d) => {
      const s = d.settings;
      const at = cart.date ?? nowISO();
      const by = currentUser()?.user.id ?? null;
      const location = d.locations.find((l) => l.id === locationId);
      if (!location) throw new NotFoundError("Location");
      const contact = d.contacts.find((c) => c.id === cart.contactId);
      if (!contact) throw new NotFoundError("Contact");
      const isWalkIn = contact.id === WALK_IN_ID || contact.isDefault;

      const totals = cartTotals(cart, { rounding: s.sale.roundingMethod, rewards: s.rewards });
      const tid = uid("t");

      const lines = cart.lines.map((l, i) => {
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

      if (cart.pointsRedeemed > 0) {
        const cap = isWalkIn ? 0 : maxRedeemable({ total: totals.total + totals.redeemed, balance: contact.points, s: s.rewards });
        if (cart.pointsRedeemed > cap) throw new ValidationError({ pointsRedeemed: "invalid" });
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
          const accountId = location.defaultAccounts[method] ?? null;
          payments.push({ id: pid, refNo: takeRef(d, s.prefixes.sellPayment, at), amount, method, accountId, paidOn: at, note, isReturn, details, createdBy: by });
          if (accountId) {
            d.accountTxns.push(accountTxn.parse({
              id: uid("at"), createdAt: at, createdBy: by, accountId, kind: isReturn ? "debit" : "credit", subType: "payment",
              amount, date: at, transactionId: tid, paymentId: pid,
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
        const scheme = d.invoiceSchemes.find((x) => x.id === location.invoiceSchemeId);
        if (!scheme) throw new NotFoundError("Invoice scheme");
        refNo = nextInvoiceNo(scheme);
        scheme.count += 1;
        invoiceSchemeId = scheme.id;
      } else {
        refNo = takeRef(d, s.prefixes.draft, at);
      }

      const earned = status === "final" && !isWalkIn ? pointsEarned(totals.total, s.rewards) : 0;
      if (status === "final" && !isWalkIn) contact.points = Math.max(0, contact.points - cart.pointsRedeemed + earned);

      if (cart.resumedFromId) {
        const i = d.transactions.findIndex((t) => t.id === cart.resumedFromId && t.type === "sell" && EDITABLE.includes(t.status));
        if (i >= 0) d.transactions.splice(i, 1);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lines: _l, ...orderTotals } = totals;
      d.transactions.push(transaction.parse({
        id: tid, createdAt: nowISO(), createdBy: by, type: "sell", status, channel: "pos", locationId, contactId: contact.id, refNo, date: at,
        lines, discount: cart.discount, orderTaxId: cart.orderTaxId, orderTaxRate: cart.orderTaxRate,
        pointsRedeemed: status === "final" ? cart.pointsRedeemed : 0, pointsEarned: earned,
        shipping: {
          zone: cart.shipping.zone, charges: cart.shipping.charges, details: cart.shipping.details, address: cart.shipping.address,
          status: status === "final" && cart.shipping.zone ? "ordered" : null,
        },
        totals: orderTotals, payments,
        paymentStatus: status === "final" ? paymentStatus({ total: totals.total, paid, date: at, payTerm: contact.payTerm }) : "due",
        payTerm: contact.payTerm, notes: cart.note, staffNote: input.staffNote ?? "", invoiceSchemeId,
        invoiceLayoutId: cart.invoiceLayoutId, technicianId: cart.technicianId,
      }));

      result = { id: tid, refNo, status, total: totals.total, paid, change, due: roundMoney(Math.max(0, totals.total - paid)) };
    });
    return result;
  },

  async toCart(id: string): Promise<Cart> {
    await delay();
    const d = getDB();
    const t = d.transactions.find((x) => x.id === id && x.type === "sell" && EDITABLE.includes(x.status));
    if (!t) throw new NotFoundError("Sale");
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
  },

  async list(q: { locationId: string; status: SaleStatus; limit?: number }): Promise<SaleRow[]> {
    await delay();
    const d = getDB();
    const names = new Map(d.contacts.map((c) => [c.id, c.name]));
    return d.transactions
      .filter((t) => t.type === "sell" && t.locationId === q.locationId && t.status === q.status)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, q.limit ?? 10)
      .map((t) => ({
        id: t.id, refNo: t.refNo, date: t.date, status: t.status as SaleStatus, contactName: names.get(t.contactId ?? "") ?? "",
        itemsCount: t.totals.itemsCount, total: t.totals.total, note: t.staffNote || t.notes,
      }));
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
    commit((d) => {
      const i = d.transactions.findIndex((t) => t.id === id);
      if (i < 0) throw new NotFoundError("Sale");
      if (!EDITABLE.includes(d.transactions[i].status)) throw new AppError("Final sales can't be deleted here", "not_deletable");
      d.transactions.splice(i, 1);
    });
  },
};
