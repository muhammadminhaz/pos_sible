import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { account, type Account, type AccountTxn, type DB } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { paymentKind } from "@/lib/domain/ledger";
import { roundMoney } from "@/lib/domain/money";
import { accountBalance, assertPostable, pushAccountTxn } from "./_ledger";
import { crud } from "./catalog";
import { delay, matches, nowISO, paginate, uid, type ListQuery, type ListResult } from "./_util";

export type AccountInput = Pick<Account, "name" | "typeId" | "number" | "note" | "details" | "openingBalance" | "allowOverdraft"> & { id?: string };
export type AccountRow = {
  id: string; name: string; typeId: string | null; typeName: string; subTypeName: string; number: string; note: string; details: Account["details"];
  balance: number; status: Account["status"]; allowOverdraft: boolean; addedBy: string;
};
export type BookRow = {
  id: string; date: string; kind: AccountTxn["kind"]; subType: AccountTxn["subType"]; description: string; refNo: string; note: string;
  credit: number; debit: number; balance: number; addedBy: string;
};
export type AccountBook = { account: Account; opening: number; rows: BookRow[]; closing: number };
export type TransferInput = { from: string; to: string; amount: number; note: string; date?: string };
export type DepositInput = { accountId: string; fromAccountId?: string | null; amount: number; note: string; date?: string };

export type PaymentReportFilters = ListQuery & {
  accountId?: string; linked?: "linked" | "unlinked"; type?: string; locationId?: string; from?: string; to?: string;
};
export type PaymentReportRow = {
  paymentId: string; transactionId: string; date: string; paymentRef: string; refNo: string; amount: number; type: string; method: string;
  accountId: string | null; accountName: string; description: string; locationName: string; kind: "credit" | "debit";
};

const PAYING_TYPES = ["sell", "sell_return", "purchase", "purchase_return", "expense"];

const userName = (d: DB, id: string | null) => {
  const u = d.users.find((x) => x.id === id);
  return u ? `${u.firstName} ${u.lastName}`.trim() : "";
};

function row(d: DB, a: Account): AccountRow {
  const type = d.accountTypes.find((x) => x.id === a.typeId);
  const parent = type?.parentId ? d.accountTypes.find((x) => x.id === type.parentId) : undefined;
  return {
    id: a.id, name: a.name, typeId: a.typeId, typeName: (parent ?? type)?.name ?? "", subTypeName: parent ? (type?.name ?? "") : "", number: a.number, note: a.note, details: a.details,
    balance: accountBalance(d, a.id), status: a.status, allowOverdraft: a.allowOverdraft, addedBy: userName(d, a.createdBy),
  };
}

function find(d: DB, id: string): Account {
  const a = d.accounts.find((x) => x.id === id);
  if (!a) throw new NotFoundError("Account");
  return a;
}

/** Rejects a debit that would take the balance below zero on an account that doesn't allow it. */
function assertFunds(d: DB, a: Account, amount: number) {
  if (!a.allowOverdraft && accountBalance(d, a.id) - amount < 0) throw new ValidationError({ amount: "overdraft" });
}

/** The same-account check comes first, then each side must exist and be open. `fields` names the form fields in errors. */
function checkPair(d: DB, from: string, to: string, fields: { from: string; to: string }) {
  if (from === to) throw new ValidationError({ [fields.to]: "same_account" });
  const src = find(d, from);
  find(d, to);
  assertPostable(d, to, fields.to);
  assertPostable(d, from, fields.from);
  return src;
}

function validateInput(d: DB, input: AccountInput) {
  if (!input.name.trim()) throw new ValidationError({ name: "required" });
  if (input.typeId && !d.accountTypes.some((t) => t.id === input.typeId)) throw new NotFoundError("Account type");
  if (!(input.openingBalance >= 0)) throw new ValidationError({ openingBalance: "negative" });
}

export const accountsService = {
  /** Account types and sub-types: plain CRUD with the rules in `catalog.ts`. */
  types: crud("accountTypes"),

  async list(f: { status?: Account["status"]; search?: string } = {}): Promise<AccountRow[]> {
    await delay();
    const d = getDB();
    return d.accounts
      .filter((a) => !f.status || a.status === f.status)
      .map((a) => row(d, a))
      .filter((r) => matches(f.search, r.name, r.number, r.typeName, r.subTypeName))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<AccountRow> {
    await delay();
    const d = getDB();
    return row(d, find(d, id));
  },

  async save(input: AccountInput): Promise<{ id: string }> {
    await delay();
    assertCan("account.manage");
    let id = input.id ?? "";
    commit((d) => {
      validateInput(d, input);
      const by = currentUser()?.user.id ?? null;
      const at = nowISO();
      const prev = input.id ? find(d, input.id) : undefined;
      const next = account.parse({
        id: prev?.id ?? uid("acc"), createdAt: prev?.createdAt ?? at, createdBy: prev?.createdBy ?? by, name: input.name.trim(), typeId: input.typeId, number: input.number.trim(),
        note: input.note, details: input.details, openingBalance: roundMoney(input.openingBalance), status: prev?.status ?? "active", allowOverdraft: input.allowOverdraft,
      });
      id = next.id;
      if (prev) d.accounts[d.accounts.indexOf(prev)] = next;
      else d.accounts.push(next);
      // The opening balance lives in the ledger as one entry, so the balance is always just credits − debits.
      const opening = d.accountTxns.find((x) => x.accountId === id && x.subType === "opening_balance");
      if (opening) {
        if (next.openingBalance > 0) Object.assign(opening, { amount: next.openingBalance });
        else d.accountTxns = d.accountTxns.filter((x) => x !== opening);
      } else if (next.openingBalance > 0) {
        pushAccountTxn(d, { accountId: id, kind: "credit", subType: "opening_balance", amount: next.openingBalance, date: at });
      }
    });
    return { id };
  },

  async close(id: string): Promise<void> {
    await delay();
    assertCan("account.manage");
    commit((d) => {
      const a = find(d, id);
      if (accountBalance(d, id) !== 0) throw new ValidationError({ balance: "not_zero" });
      a.status = "closed";
    });
  },

  async reopen(id: string): Promise<void> {
    await delay();
    assertCan("account.manage");
    commit((d) => void (find(d, id).status = "active"));
  },

  /** Ledger of one account, oldest first, with the balance after each entry. `opening` is the balance before `range.from`. */
  async book(id: string, range: { from?: string; to?: string } = {}): Promise<AccountBook> {
    await delay();
    const d = getDB();
    const a = find(d, id);
    const day = (x: AccountTxn) => x.date.slice(0, 10);
    const sorted = d.accountTxns
      .filter((x) => x.accountId === id)
      .sort((x, y) => Number(y.subType === "opening_balance") - Number(x.subType === "opening_balance") || x.date.localeCompare(y.date) || x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id));
    const signed = (x: AccountTxn) => (x.kind === "credit" ? x.amount : -x.amount);
    // The opening balance precedes everything, whatever date it was entered with.
    const carried = (x: AccountTxn) => !!range.from && (x.subType === "opening_balance" || day(x) < range.from);
    const opening = roundMoney(sorted.filter(carried).reduce((s, x) => s + signed(x), 0));
    let running = opening;
    const rows = sorted
      .filter((x) => !carried(x) && (!range.to || day(x) <= range.to))
      .map((x): BookRow => {
        running = roundMoney(running + signed(x));
        const t = x.transactionId ? d.transactions.find((y) => y.id === x.transactionId) : undefined;
        const p = t?.payments.find((y) => y.id === x.paymentId);
        const other = x.transferPairId ? d.accountTxns.find((y) => y.transferPairId === x.transferPairId && y.id !== x.id) : undefined;
        const otherName = other ? d.accounts.find((y) => y.id === other.accountId)?.name : undefined;
        return {
          id: x.id, date: x.date, kind: x.kind, subType: x.subType, description: otherName ?? t?.type ?? "", refNo: p?.refNo ?? t?.refNo ?? "", note: x.note,
          credit: x.kind === "credit" ? x.amount : 0, debit: x.kind === "debit" ? x.amount : 0, balance: running, addedBy: userName(d, x.createdBy),
        };
      });
    return { account: a, opening, rows, closing: running };
  },

  async transfer(input: TransferInput): Promise<void> {
    await delay();
    assertCan("account.manage");
    const amount = roundMoney(input.amount);
    if (!(amount > 0)) throw new ValidationError({ amount: "positive" });
    commit((d) => {
      const src = checkPair(d, input.from, input.to, { from: "from", to: "to" });
      assertFunds(d, src, amount);
      const pair = uid("tp");
      const date = input.date ?? nowISO();
      const shared = { amount, date, note: input.note, transferPairId: pair, subType: "fund_transfer" as const };
      pushAccountTxn(d, { ...shared, accountId: input.from, kind: "debit" });
      pushAccountTxn(d, { ...shared, accountId: input.to, kind: "credit" });
    });
  },

  /** Money into an account; with `fromAccountId` it also leaves that account (paired), otherwise it's an outside deposit. */
  async deposit(input: DepositInput): Promise<void> {
    await delay();
    assertCan("account.manage");
    const amount = roundMoney(input.amount);
    if (!(amount > 0)) throw new ValidationError({ amount: "positive" });
    commit((d) => {
      const date = input.date ?? nowISO();
      const shared = { amount, date, note: input.note, subType: "deposit" as const };
      if (!input.fromAccountId) {
        find(d, input.accountId);
        assertPostable(d, input.accountId);
        pushAccountTxn(d, { ...shared, accountId: input.accountId, kind: "credit" });
        return;
      }
      if (input.fromAccountId === input.accountId) throw new ValidationError({ fromAccountId: "same_account" });
      const src = find(d, input.fromAccountId);
      find(d, input.accountId);
      assertPostable(d, input.accountId);
      assertPostable(d, input.fromAccountId, "fromAccountId");
      assertFunds(d, src, amount);
      const pair = uid("tp");
      pushAccountTxn(d, { ...shared, accountId: input.fromAccountId, kind: "debit", transferPairId: pair });
      pushAccountTxn(d, { ...shared, accountId: input.accountId, kind: "credit", transferPairId: pair });
    });
  },

  /** Every payment on every document, with the account it went through (if any). */
  async paymentReport(f: PaymentReportFilters = {}): Promise<ListResult<PaymentReportRow>> {
    await delay();
    const d = getDB();
    const names = new Map(d.accounts.map((a) => [a.id, a.name]));
    const rows: PaymentReportRow[] = [];
    for (const t of d.transactions) {
      if (!PAYING_TYPES.includes(t.type) || (f.type && t.type !== f.type) || (f.locationId && t.locationId !== f.locationId)) continue;
      for (const p of t.payments) {
        const day = p.paidOn.slice(0, 10);
        if ((f.from && day < f.from) || (f.to && day > f.to)) continue;
        if (f.accountId && p.accountId !== f.accountId) continue;
        if (f.linked === "linked" && !p.accountId) continue;
        if (f.linked === "unlinked" && p.accountId) continue;
        if (!matches(f.search, p.refNo, t.refNo, p.note, names.get(p.accountId ?? ""))) continue;
        rows.push({
          paymentId: p.id, transactionId: t.id, date: p.paidOn, paymentRef: p.refNo, refNo: t.refNo, amount: p.amount, type: t.type, method: p.method, accountId: p.accountId,
          accountName: names.get(p.accountId ?? "") ?? "", description: p.note, locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", kind: paymentKind(t, p),
        });
      }
    }
    return paginate(rows.sort((a, b) => b.date.localeCompare(a.date)), f);
  },

  /** Points a payment at an account (moving it if it already had one) and re-posts its ledger entry. */
  async linkAccount(transactionId: string, paymentId: string, accountId: string): Promise<void> {
    await delay();
    assertCan("account.manage");
    commit((d) => {
      const t = d.transactions.find((x) => x.id === transactionId && PAYING_TYPES.includes(x.type));
      const p = t?.payments.find((x) => x.id === paymentId);
      if (!t || !p) throw new NotFoundError("Payment");
      assertPostable(d, accountId);
      p.accountId = accountId;
      d.accountTxns = d.accountTxns.filter((a) => a.paymentId !== paymentId);
      pushAccountTxn(d, { accountId, kind: paymentKind(t, p), subType: "payment", amount: p.amount, date: p.paidOn, transactionId, paymentId });
    });
  },
};
