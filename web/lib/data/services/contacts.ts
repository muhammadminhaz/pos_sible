import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { accountTxn, contact, type Contact, type DB, type PaymentMethod } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentStatus, paymentSummary } from "@/lib/domain/payments";
import { todayISO } from "@/lib/dates";
import { customerPoints } from "@/lib/domain/rewards";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";
import { defaultAccountId } from "./_ledger";

export type ContactRow = Contact & {
  groupName?: string;
  /** Sells for customers, purchases for suppliers (both for "both"). */
  totalInvoice: number;
  totalPaid: number;
  due: number;
  returnDue: number;
  sellDue: number;
  purchaseDue: number;
  sellReturnDue: number;
  purchaseReturnDue: number;
  lastSellDate: string | null;
  /** `points` above is what can be spent; these say what lapsed and what is about to. */
  pointsExpired: number;
  pointsExpiring: { points: number; on: string } | null;
};

export type ContactFilters = ListQuery & {
  type?: "supplier" | "customer";
  customerGroupId?: string;
  assignedTo?: string;
  active?: "active" | "inactive";
  hasDue?: boolean;
  /** Owes us on sales / we owe on purchases. */
  sellDue?: boolean;
  purchaseDue?: boolean;
  sellReturn?: boolean;
  purchaseReturn?: boolean;
  advance?: boolean;
  opening?: boolean;
  /** Customers with no sale in the last N months (never bought counts too). */
  noSellMonths?: number;
  today?: string;
};

const isInvoice = (t: DB["transactions"][number]) => (t.type === "sell" && t.status === "final") || (t.type === "purchase" && t.status === "received");

function toRows(db: DB): ContactRow[] {
  const group = new Map(db.customerGroups.map((g) => [g.id, g.name]));
  type Agg = { sell: number; purchase: number; sellReturn: number; purchaseReturn: number; invoice: number; paid: number; last: string | null };
  const agg = new Map<string, Agg>();
  for (const t of db.transactions) {
    if (!t.contactId) continue;
    const returnType = t.type === "sell_return" || t.type === "purchase_return";
    if (!isInvoice(t) && !returnType) continue;
    const a = agg.get(t.contactId) ?? { sell: 0, purchase: 0, sellReturn: 0, purchaseReturn: 0, invoice: 0, paid: 0, last: null };
    const s = paymentSummary(t.totals.total, t.payments);
    if (t.type === "sell") a.sell += s.due;
    else if (t.type === "purchase") a.purchase += s.due;
    else if (t.type === "sell_return") a.sellReturn += s.due;
    else a.purchaseReturn += s.due;
    if (!returnType) {
      a.invoice += t.totals.total;
      a.paid += Math.min(s.paid, t.totals.total);
    }
    if (t.type === "sell" && (!a.last || t.date > a.last)) a.last = t.date;
    agg.set(t.contactId, a);
  }
  return db.contacts.map((c) => {
    const a = agg.get(c.id) ?? { sell: 0, purchase: 0, sellReturn: 0, purchaseReturn: 0, invoice: 0, paid: 0, last: null };
    const returnDue = a.sellReturn + a.purchaseReturn;
    const pts = customerPoints(db, c, todayISO());
    return {
      ...c,
      points: pts.available,
      pointsExpired: pts.expired,
      pointsExpiring: pts.expiring,
      groupName: c.customerGroupId ? group.get(c.customerGroupId) : undefined,
      totalInvoice: roundMoney(a.invoice),
      totalPaid: roundMoney(a.paid),
      due: roundMoney(a.invoice - a.paid + c.openingBalance - returnDue),
      returnDue: roundMoney(returnDue),
      sellDue: roundMoney(a.sell),
      purchaseDue: roundMoney(a.purchase),
      sellReturnDue: roundMoney(a.sellReturn),
      purchaseReturnDue: roundMoney(a.purchaseReturn),
      lastSellDate: a.last,
    };
  });
}

export type NewCustomer = { name: string; mobile: string; customerGroupId?: string | null; address?: string };
export type ContactInput = Omit<Contact, "id" | "createdAt" | "createdBy" | "code" | "points" | "advanceBalance" | "isDefault"> & { id?: string };

export type LedgerEntry = {
  key: string; date: string; kind: "opening" | "invoice" | "return" | "payment" | "refund"; refNo: string; txnId: string | null;
  /** Increases what the contact owes (or what we owe them, for a supplier). */
  debit: number;
  credit: number;
  balance: number;
  method?: PaymentMethod;
};

const TYPE_PERMISSION = { supplier: "contacts.supplier", customer: "contacts.customer" } as const;
const canSee = (type: Contact["type"], write: (p: string) => void) => {
  if (type !== "customer") write(TYPE_PERMISSION.supplier);
  if (type !== "supplier") write(TYPE_PERMISSION.customer);
};

function checkContact(d: DB, input: ContactInput) {
  const fields: Record<string, string> = {};
  if (!input.name.trim()) fields.name = "required";
  if (!input.mobile.trim()) fields.mobile = "required";
  else if (d.contacts.some((c) => c.id !== input.id && c.mobile.trim() === input.mobile.trim())) fields.mobile = "duplicate";
  if (input.creditLimit != null && input.creditLimit < 0) fields.creditLimit = "invalid";
  if (Object.keys(fields).length) throw new ValidationError(fields);
}

export const contactsService = service("contactsService", {
  async list(f: ContactFilters = {}): Promise<ListResult<ContactRow>> {
    await delay();
    const today = f.today ?? nowISO().slice(0, 10);
    const cutoff = f.noSellMonths
      ? (() => {
          const x = new Date(`${today}T00:00:00`);
          x.setMonth(x.getMonth() - f.noSellMonths);
          return x.toISOString().slice(0, 10);
        })()
      : null;
    const rows = toRows(getDB()).filter(
      (c) =>
        (!f.type || c.type === f.type || c.type === "both") &&
        (!f.customerGroupId || c.customerGroupId === f.customerGroupId) &&
        (!f.assignedTo || c.assignedTo.includes(f.assignedTo)) &&
        (!f.active || c.active === (f.active === "active")) &&
        (!f.hasDue || c.due > 0) &&
        (!f.sellDue || c.sellDue > 0) &&
        (!f.purchaseDue || c.purchaseDue > 0) &&
        (!f.sellReturn || c.sellReturnDue > 0) &&
        (!f.purchaseReturn || c.purchaseReturnDue > 0) &&
        (!f.advance || c.advanceBalance > 0) &&
        (!f.opening || c.openingBalance !== 0) &&
        (!cutoff || (!c.isDefault && (c.type !== "supplier") && (!c.lastSellDate || c.lastSellDate.slice(0, 10) < cutoff))) &&
        matches(f.search, c.name, c.businessName, c.mobile, c.code, c.email, c.taxNumber),
    );
    return paginate(f.sort ? rows : rows.filter((c) => c.isDefault).concat(rows.filter((c) => !c.isDefault)), f);
  },

  async get(id: string): Promise<ContactRow> {
    await delay();
    const row = toRows(getDB()).find((c) => c.id === id);
    if (!row) throw new NotFoundError("Contact");
    return row;
  },

  async setActive(ids: string[], active: boolean): Promise<void> {
    await delay();
    commit((d) => {
      for (const c of d.contacts) if (ids.includes(c.id) && !c.isDefault) c.active = active;
    });
  },

  async createCustomer(input: NewCustomer): Promise<Contact> {
    await delay();
    const name = input.name.trim();
    const mobile = input.mobile.trim();
    const fields: Record<string, string> = {};
    if (!name) fields.name = "required";
    if (!mobile) fields.mobile = "required";
    else if (getDB().contacts.some((c) => c.mobile.trim() === mobile)) fields.mobile = "duplicate";
    if (Object.keys(fields).length) throw new ValidationError(fields);
    let created!: Contact;
    commit((d) => {
      const n = Math.max(0, ...d.contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0)) + 1;
      created = contact.parse({
        id: uid("c"),
        createdAt: nowISO(),
        createdBy: currentUser()?.user.id ?? null,
        code: `${d.settings.prefixes.contacts}${String(n).padStart(4, "0")}`,
        type: "customer",
        name,
        mobile,
        customerGroupId: input.customerGroupId ?? null,
        address: { line1: input.address?.trim() ?? "" },
      });
      d.contacts.push(created);
    });
    return created;
  },

  /** Full create/edit. Needs the permission for every side the contact is on. */
  async save(input: ContactInput): Promise<{ id: string }> {
    await delay();
    canSee(input.type, assertCan);
    let id = input.id ?? "";
    commit((d) => {
      checkContact(d, input);
      const clean = { ...input, name: input.name.trim(), mobile: input.mobile.trim() };
      if (input.id) {
        const i = d.contacts.findIndex((c) => c.id === input.id);
        if (i < 0) throw new NotFoundError("Contact");
        if (d.contacts[i].isDefault) throw new AppError("The walk-in customer can't be edited", "default_contact");
        d.contacts[i] = contact.parse({ ...d.contacts[i], ...clean });
      } else {
        id = uid("c");
        const n = Math.max(0, ...d.contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0)) + 1;
        d.contacts.push(contact.parse({
          ...clean, id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null,
          code: `${d.settings.prefixes.contacts}${String(n).padStart(4, "0")}`,
        }));
      }
    });
    return { id };
  },

  /** Contacts with any transaction can't be deleted (deactivate them); neither can the walk-in customer. */
  async remove(ids: string[]): Promise<void> {
    await delay();
    const d = getDB();
    for (const id of ids) {
      const c = d.contacts.find((x) => x.id === id);
      if (!c) throw new NotFoundError("Contact");
      canSee(c.type, assertCan);
      if (c.isDefault) throw new AppError("The walk-in customer can't be deleted", "default_contact");
      if (d.transactions.some((t) => t.contactId === id)) throw new AppError(`${c.name} has transactions`, "contact_in_use");
    }
    commit((draft) => {
      draft.contacts = draft.contacts.filter((c) => !ids.includes(c.id));
    });
  },

  /** Every money movement for one contact, oldest first, with a running balance (what they owe; negative = we owe them). */
  async ledger(id: string): Promise<LedgerEntry[]> {
    await delay();
    const d = getDB();
    const c = d.contacts.find((x) => x.id === id);
    if (!c) throw new NotFoundError("Contact");
    const raw: Omit<LedgerEntry, "balance">[] = [];
    if (c.openingBalance) {
      raw.push({ key: "opening", date: c.createdAt, kind: "opening", refNo: "", txnId: null, debit: Math.max(0, c.openingBalance), credit: Math.max(0, -c.openingBalance) });
    }
    for (const t of d.transactions) {
      if (t.contactId !== id) continue;
      if (isInvoice(t)) {
        raw.push({ key: t.id, date: t.date, kind: "invoice", refNo: t.refNo, txnId: t.id, debit: t.totals.total, credit: 0 });
        for (const p of t.payments.filter((x) => !x.isReturn)) raw.push({ key: p.id, date: p.paidOn, kind: "payment", refNo: p.refNo, txnId: t.id, debit: 0, credit: p.amount, method: p.method });
      } else if (t.type === "sell_return" || t.type === "purchase_return") {
        raw.push({ key: t.id, date: t.date, kind: "return", refNo: t.refNo, txnId: t.id, debit: 0, credit: t.totals.total });
        for (const p of t.payments.filter((x) => !x.isReturn)) raw.push({ key: p.id, date: p.paidOn, kind: "refund", refNo: p.refNo, txnId: t.id, debit: p.amount, credit: 0, method: p.method });
      }
    }
    raw.sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    return raw.map((e) => ({ ...e, balance: (balance = roundMoney(balance + e.debit - e.credit)) }));
  },

  /**
   * Settles dues oldest first: invoices in date order, then any positive opening balance.
   * Never takes more than is owed.
   */
  async payDue(id: string, p: { amount: number; method: PaymentMethod; accountId?: string | null; note?: string }): Promise<{ allocated: number }> {
    await delay();
    const amount = roundMoney(p.amount);
    let allocated = 0;
    commit((d) => {
      const c = d.contacts.find((x) => x.id === id);
      if (!c) throw new NotFoundError("Contact");
      if (c.isDefault) throw new AppError("The walk-in customer has no dues", "default_contact");
      const open = d.transactions
        .filter((t) => t.contactId === id && isInvoice(t) && paymentSummary(t.totals.total, t.payments).due > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      const kinds = new Set(open.map((t) => t.type));
      if (kinds.has("sell")) assertCan("sell.payments");
      if (kinds.has("purchase")) assertCan("purchase.payments");
      const owed = roundMoney(open.reduce((s, t) => s + paymentSummary(t.totals.total, t.payments).due, 0) + Math.max(0, c.openingBalance));
      if (!(amount > 0) || amount > owed) throw new ValidationError({ amount: "invalid" });
      const by = currentUser()?.user.id ?? null;
      const at = nowISO();
      let left = amount;
      for (const t of open) {
        if (left <= 0) break;
        const take = Math.min(left, paymentSummary(t.totals.total, t.payments).due);
        const pid = uid("pay");
        const accountId = p.accountId ?? defaultAccountId(d, t.locationId, p.method);
        const prefix = t.type === "sell" ? d.settings.prefixes.sellPayment : d.settings.prefixes.purchasePayment;
        t.payments.push({ id: pid, refNo: takeRef(d, prefix, at), amount: roundMoney(take), method: p.method, accountId, paidOn: at, note: p.note ?? "", isReturn: false, details: {}, createdBy: by });
        if (accountId) {
          d.accountTxns.push(accountTxn.parse({ id: uid("at"), createdAt: at, createdBy: by, accountId, kind: t.type === "sell" ? "credit" : "debit", subType: "payment", amount: roundMoney(take), date: at, transactionId: t.id, paymentId: pid }));
        }
        t.paymentStatus = paymentStatus({ total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, date: t.date, payTerm: t.payTerm });
        left = roundMoney(left - take);
      }
      if (left > 0) c.openingBalance = roundMoney(c.openingBalance - left);
      allocated = amount;
    });
    return { allocated };
  },
});
