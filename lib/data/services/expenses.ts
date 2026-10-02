import { addDays, addMonths, addYears, format, getDaysInMonth, parseISO, setDate } from "date-fns";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { transaction, type DB, type Payment, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { expenseSign } from "@/lib/domain/ledger";
import { roundMoney } from "@/lib/domain/money";
import { paymentStatus, paymentSummary, type PaymentStatus } from "@/lib/domain/payments";
import { assertPostable, defaultAccountId, pushAccountTxn } from "./_ledger";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";

export type NewExpense = { locationId: string; categoryId: string; amount: number; method: PaymentMethod; note?: string };
export type Recurring = NonNullable<Transaction["recurring"]>;
export type ExpensePaymentInput = { method: PaymentMethod; amount: number; note?: string; paidOn?: string; accountId?: string | null; details?: Payment["details"] };
export type ExpenseInput = {
  id?: string; locationId: string; categoryId: string; subCategoryId?: string | null; refNo?: string; date: string;
  forUserId?: string | null; contactId?: string | null; taxId?: string | null;
  /** Before tax; the stored total is amount + tax. */
  amount: number; note: string; isRefund: boolean; recurring?: Omit<Recurring, "parentId"> | null; documents?: string[];
  /** New expense: paid up front. Edit: replaces the payments (omit to keep them). Later payments go through `addPayment`. */
  payments?: ExpensePaymentInput[];
};

export type ExpenseFilters = ListQuery & {
  locationId?: string; categoryId?: string; subCategoryId?: string; contactId?: string; userId?: string;
  paymentStatus?: PaymentStatus; from?: string; to?: string;
};
export type ExpenseRow = {
  id: string; date: string; refNo: string; locationName: string; categoryName: string; subCategoryName: string; paymentStatus: PaymentStatus;
  /** Signed: refunds are negative. */
  tax: number; total: number; paid: number; due: number;
  forUserName: string; contactName: string; note: string; addedBy: string; isRefund: boolean; recurring: Transaction["recurring"];
};
export type ExpenseDetail = Transaction & { categoryName: string; subCategoryName: string; locationName: string; forUserName: string; contactName: string; addedBy: string; paid: number; due: number };

const userName = (d: DB, id: string | null | undefined) => {
  const u = d.users.find((x) => x.id === id);
  return u ? `${u.firstName} ${u.lastName}`.trim() : "";
};
/** Applies the refund sign without producing `-0`. */
const signed = (k: 1 | -1, n: number) => (n === 0 ? 0 : k * n);
const taxRate = (d: DB, id: string | null | undefined) => d.taxRates.find((x) => x.id === id)?.rate ?? 0;

/** Rebuilds the ledger from the payments, so an edit can never leave a stale or doubled row behind. */
function repost(d: DB, t: Transaction) {
  d.accountTxns = d.accountTxns.filter((a) => a.transactionId !== t.id);
  for (const p of t.payments) {
    if (!p.accountId) continue;
    pushAccountTxn(d, { accountId: p.accountId, kind: t.isRefund ? "credit" : "debit", subType: "payment", amount: p.amount, date: p.paidOn, transactionId: t.id, paymentId: p.id });
  }
}

function refreshStatus(t: Transaction) {
  t.paymentStatus = paymentStatus({ total: t.totals.total, paid: paymentSummary(t.totals.total, t.payments).paid, date: t.date, payTerm: null });
}

function newPayment(d: DB, t: Pick<Transaction, "locationId" | "date">, p: ExpensePaymentInput): Payment {
  const amount = roundMoney(p.amount);
  if (!(amount > 0)) throw new ValidationError({ amount: "invalid" });
  const paidOn = p.paidOn ?? nowISO();
  const accountId = p.accountId !== undefined ? p.accountId : defaultAccountId(d, t.locationId, p.method);
  if (accountId) assertPostable(d, accountId);
  return {
    id: uid("pay"), refNo: takeRef(d, d.settings.prefixes.expensePayment, paidOn), amount, method: p.method, accountId, paidOn,
    note: p.note ?? "", isReturn: false, details: p.details ?? {}, createdBy: currentUser()?.user.id ?? null,
  };
}

function writeExpense(d: DB, input: ExpenseInput): { id: string; refNo: string } {
  const prev = input.id ? d.transactions.find((x) => x.id === input.id && x.type === "expense") : undefined;
  if (input.id && !prev) throw new NotFoundError("Expense");
  if (!d.locations.some((l) => l.id === input.locationId)) throw new NotFoundError("Location");
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new ValidationError({ amount: "positive" });
  const cat = d.expenseCategories.find((c) => c.id === input.categoryId);
  if (!input.categoryId) throw new ValidationError({ categoryId: "required" });
  if (!cat) throw new NotFoundError("Category");
  if (input.subCategoryId) {
    const sub = d.expenseCategories.find((c) => c.id === input.subCategoryId);
    if (!sub) throw new NotFoundError("Sub-category");
    if (sub.parentId !== cat.id) throw new ValidationError({ subCategoryId: "not_child" });
  }
  if (input.forUserId && !d.users.some((u) => u.id === input.forUserId)) throw new NotFoundError("User");
  if (input.contactId && !d.contacts.some((c) => c.id === input.contactId)) throw new NotFoundError("Contact");
  const rec = input.recurring;
  if (rec && (!(rec.interval >= 1) || (rec.repetitions != null && !(rec.repetitions >= 1)))) throw new ValidationError({ recurring: "invalid" });
  if (input.refNo && d.transactions.some((x) => x.type === "expense" && x.id !== prev?.id && x.refNo === input.refNo)) throw new AppError("Reference number already used", "duplicate_ref");

  const rate = taxRate(d, input.taxId);
  const tax = roundMoney((amount * rate) / 100);
  const total = roundMoney(amount + tax);
  const payments = input.payments ? input.payments.map((p) => newPayment(d, input, p)) : (prev?.payments ?? []);
  if (paymentSummary(total, payments).paid > total) throw new ValidationError({ payments: "exceeds_total" });

  const by = currentUser()?.user.id ?? null;
  const tid = prev?.id ?? uid("t");
  const refNo = prev?.refNo ?? input.refNo ?? takeRef(d, d.settings.prefixes.expense, input.date);
  const next = transaction.parse({
    id: tid, createdAt: prev?.createdAt ?? nowISO(), createdBy: prev?.createdBy ?? by, type: "expense", status: "final", locationId: input.locationId,
    contactId: input.contactId ?? null, refNo, date: input.date, lines: [], orderTaxId: input.taxId ?? null, orderTaxRate: rate,
    totals: { itemsCount: 0, linesTotal: amount, discount: 0, orderTax: tax, shipping: 0, additional: 0, redeemed: 0, roundOff: 0, total },
    payments, paymentStatus: "due", expenseCategoryId: cat.id, expenseSubCategoryId: input.subCategoryId ?? null, expenseForUserId: input.forUserId ?? null,
    isRefund: input.isRefund, notes: input.note.trim(), documents: input.documents ?? prev?.documents ?? [],
    // Copies stay linked to their parent; editing a copy never turns it into a generator.
    recurring: prev?.recurring?.parentId ? prev.recurring : rec ? { ...rec, parentId: null } : null,
  });
  refreshStatus(next);
  if (prev) d.transactions[d.transactions.indexOf(prev)] = next;
  else d.transactions.push(next);
  repost(d, next);
  return { id: tid, refNo };
}

function nextDate(from: string, rec: Recurring): string {
  const base = parseISO(from);
  let next = rec.intervalType === "days" ? addDays(base, rec.interval) : rec.intervalType === "months" ? addMonths(base, rec.interval) : addYears(base, rec.interval);
  if (rec.repeatOn && rec.intervalType !== "days") next = setDate(next, Math.min(rec.repeatOn, getDaysInMonth(next)));
  return format(next, "yyyy-MM-dd'T'HH:mm:ss");
}

function find(d: DB, id: string): Transaction {
  const t = d.transactions.find((x) => x.id === id && x.type === "expense");
  if (!t) throw new NotFoundError("Expense");
  return t;
}

export const expensesService = {
  async list(f: ExpenseFilters = {}): Promise<ListResult<ExpenseRow> & { totals: { tax: number; total: number; paid: number; due: number } }> {
    await delay();
    const d = getDB();
    const cats = new Map(d.expenseCategories.map((c) => [c.id, c.name]));
    const contacts = new Map(d.contacts.map((c) => [c.id, c.name]));
    const rows = d.transactions
      .filter((t) => t.type === "expense")
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.categoryId || t.expenseCategoryId === f.categoryId)
      .filter((t) => !f.subCategoryId || t.expenseSubCategoryId === f.subCategoryId)
      .filter((t) => !f.contactId || t.contactId === f.contactId)
      .filter((t) => !f.userId || t.expenseForUserId === f.userId)
      .filter((t) => !f.paymentStatus || t.paymentStatus === f.paymentStatus)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, t.notes, cats.get(t.expenseCategoryId ?? ""), cats.get(t.expenseSubCategoryId ?? ""), contacts.get(t.contactId ?? "")))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): ExpenseRow => {
        const s = paymentSummary(t.totals.total, t.payments);
        const k = expenseSign(t);
        return {
          id: t.id, date: t.date, refNo: t.refNo, locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "",
          categoryName: cats.get(t.expenseCategoryId ?? "") ?? "", subCategoryName: cats.get(t.expenseSubCategoryId ?? "") ?? "", paymentStatus: t.paymentStatus,
          tax: signed(k, t.totals.orderTax), total: signed(k, t.totals.total), paid: signed(k, s.paid), due: signed(k, s.due),
          forUserName: userName(d, t.expenseForUserId), contactName: contacts.get(t.contactId ?? "") ?? "", note: t.notes, addedBy: userName(d, t.createdBy),
          isRefund: t.isRefund, recurring: t.recurring,
        };
      });
    const sum = (key: "tax" | "total" | "paid" | "due") => roundMoney(rows.reduce((s, r) => s + r[key], 0));
    return { ...paginate(rows, f), totals: { tax: sum("tax"), total: sum("total"), paid: sum("paid"), due: sum("due") } };
  },

  async get(id: string): Promise<ExpenseDetail> {
    await delay();
    const d = getDB();
    const t = find(d, id);
    const s = paymentSummary(t.totals.total, t.payments);
    const cats = new Map(d.expenseCategories.map((c) => [c.id, c.name]));
    return {
      ...t, categoryName: cats.get(t.expenseCategoryId ?? "") ?? "", subCategoryName: cats.get(t.expenseSubCategoryId ?? "") ?? "",
      locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", forUserName: userName(d, t.expenseForUserId),
      contactName: d.contacts.find((c) => c.id === t.contactId)?.name ?? "", addedBy: userName(d, t.createdBy), paid: s.paid, due: s.due,
    };
  },

  /** The expense in the shape the form edits (amount before tax, payments left to the payment dialog). */
  async getForm(id: string): Promise<Omit<ExpenseInput, "payments"> & { id: string }> {
    await delay();
    const t = find(getDB(), id);
    return {
      id, locationId: t.locationId, categoryId: t.expenseCategoryId ?? "", subCategoryId: t.expenseSubCategoryId, refNo: t.refNo, date: t.date,
      forUserId: t.expenseForUserId, contactId: t.contactId, taxId: t.orderTaxId, amount: t.totals.linesTotal, note: t.notes, isRefund: t.isRefund,
      recurring: t.recurring ? { interval: t.recurring.interval, intervalType: t.recurring.intervalType, repetitions: t.recurring.repetitions, repeatOn: t.recurring.repeatOn } : null,
      documents: t.documents,
    };
  },

  async save(input: ExpenseInput): Promise<{ id: string; refNo: string }> {
    await delay();
    assertCan(input.id ? "expense.update" : "expense.create");
    let out!: { id: string; refNo: string };
    commit((d) => void (out = writeExpense(d, input)));
    return out;
  },

  async addPayment(id: string, p: ExpensePaymentInput): Promise<void> {
    await delay();
    assertCan("expense.update");
    commit((d) => {
      const t = find(d, id);
      const pay = newPayment(d, t, p);
      if (pay.amount > paymentSummary(t.totals.total, t.payments).due) throw new ValidationError({ amount: "invalid" });
      t.payments.push(pay);
      refreshStatus(t);
      repost(d, t);
    });
  },

  async removePayment(id: string, paymentId: string): Promise<void> {
    await delay();
    assertCan("expense.update");
    commit((d) => {
      const t = find(d, id);
      if (!t.payments.some((x) => x.id === paymentId)) throw new NotFoundError("Payment");
      t.payments = t.payments.filter((x) => x.id !== paymentId);
      refreshStatus(t);
      repost(d, t);
    });
  },

  async remove(id: string): Promise<void> {
    await delay();
    assertCan("expense.delete");
    commit((d) => {
      find(d, id);
      d.accountTxns = d.accountTxns.filter((a) => a.transactionId !== id);
      d.transactions = d.transactions.filter((x) => x.id !== id);
    });
  },

  /** Makes the next copy of a recurring expense, unpaid, one interval after the latest one. Refuses once `repetitions` copies exist. */
  async generateNext(id: string): Promise<Transaction> {
    await delay();
    assertCan("expense.create");
    let created!: Transaction;
    commit((d) => {
      const source = find(d, id);
      const rootId = source.recurring?.parentId ?? source.id;
      const root = find(d, rootId);
      const rec = root.recurring;
      if (!rec) throw new ValidationError({ recurring: "not_recurring" });
      const copies = d.transactions.filter((t) => t.type === "expense" && t.recurring?.parentId === rootId);
      if (rec.repetitions != null && copies.length >= rec.repetitions) throw new AppError("All repetitions have been generated", "recurrence_complete");
      const latest = [root, ...copies].reduce((a, b) => (b.date > a.date ? b : a));
      const date = nextDate(latest.date, rec);
      const at = nowISO();
      created = transaction.parse({
        ...structuredClone(root), id: uid("t"), createdAt: at, createdBy: currentUser()?.user.id ?? null, refNo: takeRef(d, d.settings.prefixes.expense, date), date,
        payments: [], paymentStatus: "due", recurring: { ...rec, parentId: rootId },
      });
      refreshStatus(created);
      d.transactions.push(created);
    });
    return created;
  },

  /** Minimal paid expense for the POS "Add expense" dialog. */
  async create(input: NewExpense): Promise<Transaction> {
    const at = nowISO();
    // The POS picker lists every category; a sub-category pick is filed under its parent.
    const picked = getDB().expenseCategories.find((c) => c.id === input.categoryId);
    const { id } = await expensesService.save({
      locationId: input.locationId, categoryId: picked?.parentId ?? input.categoryId, subCategoryId: picked?.parentId ? picked.id : null, amount: input.amount, date: at, note: input.note ?? "", isRefund: false,
      payments: [{ method: input.method, amount: input.amount, paidOn: at }],
    });
    return getDB().transactions.find((t) => t.id === id)!;
  },
};
