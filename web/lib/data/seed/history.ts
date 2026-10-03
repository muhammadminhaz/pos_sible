import {
  accountTxn, cashRegister, notification, stockLot, transaction,
  type AccountTxn, type CashRegister, type Contact, type CustomerGroup, type InvoiceScheme, type Notification,
  type PaymentMethod, type Product, type Settings, type StockLot, type TaxRate, type Transaction, type User,
  type Variation,
} from "@/lib/data/schemas";
import type { z } from "zod";
import type { payment as paymentSchema, txnLine } from "@/lib/data/schemas";
import { addDays, addMonths, format, parseISO, subDays } from "date-fns";
import { roundMoney } from "@/lib/domain/money";
import { paymentStatus, paymentSummary, type PayTerm } from "@/lib/domain/payments";
import { resolveUnitPrice } from "@/lib/domain/pricing";
import { nextInvoiceNo, nextRef } from "@/lib/domain/refs";
import { maxRedeemable, pointsEarned, redeemValue } from "@/lib/domain/rewards";
import { allocate, available } from "@/lib/domain/stock";
import { lineTotals, orderTotals, type DiscountInput } from "@/lib/domain/totals";
import { LOC_NIPUN, LOC_RANGO, mk, SEED_USER, WALK_IN } from "./mk";
import { ACC } from "./org";
import type { IdFn, Rng } from "./rng";

type PaymentIn = z.input<typeof paymentSchema>;
type LineIn = z.input<typeof txnLine>;

export type HistoryInput = {
  r: Rng;
  id: IdFn;
  today: string;
  days: number;
  settings: Settings;
  products: Product[];
  variations: Variation[];
  taxRates: TaxRate[];
  contacts: Contact[];
  customerGroups: CustomerGroup[];
  users: User[];
  invoiceSchemes: InvoiceScheme[];
  accounts: { id: string; openingBalance: number }[];
  locations: { id: string; invoiceSchemeId: string }[];
};

export type History = {
  transactions: Transaction[];
  stockLots: StockLot[];
  accountTxns: AccountTxn[];
  cashRegisters: CashRegister[];
  notifications: Notification[];
  counters: Record<string, number>;
};

const METHOD_ACCOUNT: Partial<Record<PaymentMethod, string>> = {
  cash: ACC.cash, card: ACC.bank, cheque: ACC.bank, bank_transfer: ACC.bank, custom_pay_1: ACC.bkash, custom_pay_2: ACC.nagad,
};

export function createHistory(h: HistoryInput): History {
  const { r, id, settings: s } = h;
  const todayDate = parseISO(h.today);
  const dayStr = (n: number) => format(subDays(todayDate, n), "yyyy-MM-dd");
  const ts = (date: string, hh: number, mm = r.int(0, 59)) =>
    `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(r.int(0, 59)).padStart(2, "0")}`;
  const plusDays = (date: string, n: number) => format(addDays(parseISO(date), n), "yyyy-MM-dd");

  const counters: Record<string, number> = {};
  const ref = (prefix: string, date: string) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return nextRef(prefix, Number(date.slice(0, 4)), counters[prefix]);
  };

  const transactions: Transaction[] = [];
  const stockLots: StockLot[] = [];
  const accountTxns: AccountTxn[] = [];
  const lotIndex = new Map<string, StockLot[]>();
  const lotById = new Map<string, StockLot>();
  const key = (loc: string, vid: string) => `${loc}|${vid}`;

  const productById = new Map(h.products.map((p) => [p.id, p]));
  const taxRateOf = (tid: string | null) => h.taxRates.find((t) => t.id === tid)?.rate ?? 0;
  const groupById = new Map(h.customerGroups.map((g) => [g.id, g]));
  const stockVariations = h.variations.filter((v) => {
    const p = productById.get(v.productId)!;
    return p.manageStock && p.type !== "combo";
  });
  const varsAt = (loc: string) => stockVariations.filter((v) => productById.get(v.productId)!.locationIds.includes(loc));
  const atLoc: Record<string, Variation[]> = { [LOC_RANGO]: varsAt(LOC_RANGO), [LOC_NIPUN]: varsAt(LOC_NIPUN) };
  const isKg = (p: Product) => p.unitId === "unit_kg";

  const target = (v: Variation) => {
    const p = productById.get(v.productId)!;
    if (isKg(p)) return 2000;
    if (v.purchasePriceExc > 20000) return 6;
    if (v.purchasePriceExc > 5000) return 10;
    if (v.purchasePriceExc > 1000) return 20;
    return 60;
  };

  const addLot = (lot: Omit<z.input<typeof stockLot>, "createdBy" | "createdAt"> & { createdAt?: string }) => {
    const l = mk(stockLot, { createdAt: lot.receivedAt, createdBy: SEED_USER, ...lot });
    stockLots.push(l);
    lotById.set(l.id, l);
    const k = key(l.locationId, l.variationId);
    if (!lotIndex.has(k)) lotIndex.set(k, []);
    lotIndex.get(k)!.push(l);
    return l;
  };
  const avail = (loc: string, vid: string) => available(lotIndex.get(key(loc, vid)) ?? [], vid, loc);
  const take = (loc: string, vid: string, qty: number) => {
    const res = allocate(lotIndex.get(key(loc, vid)) ?? [], { variationId: vid, locationId: loc, qty, method: s.business.accountingMethod });
    for (const a of res.allocations) {
      const lot = lotById.get(a.lotId)!;
      lot.qtyRemaining = roundMoney(lot.qtyRemaining - a.qty, 4);
    }
    return res;
  };
  const expiryFor = (p: Product, date: string) =>
    p.expiryPeriod ? format(addMonths(parseISO(date), p.expiryPeriod), "yyyy-MM-dd") : null;

  const balances = new Map(h.accounts.map((a) => [a.id, a.openingBalance]));
  const ledger = (accountId: string, kind: "credit" | "debit", subType: AccountTxn["subType"], amount: number, date: string, extra: Partial<AccountTxn> = {}) => {
    accountTxns.push(mk(accountTxn, { id: id("at"), createdAt: date, createdBy: SEED_USER, accountId, kind, subType, amount, date, ...extra }));
    balances.set(accountId, roundMoney((balances.get(accountId) ?? 0) + (kind === "credit" ? amount : -amount)));
  };
  const startDate = dayStr(h.days);
  for (const a of h.accounts) ledger(a.id, "credit", "opening_balance", a.openingBalance, `${startDate}T08:00:00`);

  /** Payment + its ledger entry. `incoming` = money into our accounts. */
  const pay = (txnId: string, prefix: string, amount: number, method: PaymentMethod, paidOn: string, incoming: boolean, by: string | null, extra: Partial<PaymentIn> = {}): PaymentIn => {
    const pid = id("pay");
    const accountId = METHOD_ACCOUNT[method] ?? null;
    if (accountId) ledger(accountId, incoming ? "credit" : "debit", "payment", amount, paidOn, { transactionId: txnId, paymentId: pid });
    const details: PaymentIn["details"] =
      method === "card" ? { cardNumber: `**** ${r.int(1000, 9999)}`, cardType: r.pick(["visa", "master", "debit"] as const), cardHolder: "" }
      : method === "cheque" ? { chequeNo: String(r.int(100000, 999999)) }
      : method === "bank_transfer" ? { bankAccountNo: `1502${r.int(100000, 999999)}` }
      : method.startsWith("custom_pay") ? { txnNo: `${String.fromCharCode(65 + r.int(0, 25))}${r.int(10, 99)}${String.fromCharCode(65 + r.int(0, 25))}${r.int(1000000, 9999999)}` }
      : {};
    return { id: pid, refNo: ref(prefix, paidOn), amount: roundMoney(amount), method, accountId, paidOn, details, createdBy: by, ...extra };
  };

  const statusOf = (total: number, payments: PaymentIn[], date: string, term: PayTerm | null | undefined) =>
    paymentStatus({ total, paid: paymentSummary(total, payments.map((p) => ({ amount: p.amount, isReturn: p.isReturn }))).paid, date, payTerm: term, today: h.today });

  const push = (t: z.input<typeof transaction>) => {
    const tx = mk(transaction, t);
    transactions.push(tx);
    return tx;
  };

  // ── Opening stock ────────────────────────────────────────────────────
  for (const loc of [LOC_RANGO, LOC_NIPUN]) {
    for (const v of atLoc[loc]) {
      const p = productById.get(v.productId)!;
      const t = target(v);
      const qty = isKg(p) ? r.int(20, 40) * 50 : Math.max(2, Math.round(t * (0.6 + r.next() * 0.6)));
      const receivedAt = `${startDate}T08:30:00`;
      addLot({ id: id("lot"), locationId: loc, variationId: v.id, productId: p.id, sourceTxnId: null, qtyIn: qty, qtyRemaining: qty, unitCost: v.purchasePriceExc, receivedAt, lotNo: isKg(p) ? `OPN-${loc === LOC_RANGO ? "R" : "N"}-${p.sku}` : "", expDate: expiryFor(p, startDate) });
    }
  }

  // ── Contacts by role ─────────────────────────────────────────────────
  const suppliersE = h.contacts.filter((c) => /^sup_0[1-8]$/.test(c.id) || c.id === "both_2" || c.id === "sup_17" || c.id === "sup_18");
  const suppliersF = h.contacts.filter((c) => /^sup_(09|1[0-6])$/.test(c.id) || c.id === "both_1" || c.id === "sup_19" || c.id === "sup_20");
  const customers = h.contacts.filter((c) => c.type !== "supplier" && c.id !== WALK_IN);
  const points = new Map<string, number>();

  const staffAt: Record<string, Record<"pos" | "web", string[]>> = {
    [LOC_RANGO]: { pos: ["user_cashier", SEED_USER, "user_cashier"], web: [SEED_USER, "user_sales1", "user_sales2", "user_manager"] },
    [LOC_NIPUN]: { pos: ["user_nipun", "user_nipun", SEED_USER], web: ["user_nipun", "user_sales3", SEED_USER] },
  };
  const agentIds = new Set(h.users.filter((u) => u.isSalesAgent).map((u) => u.id));
  const scheme = new Map(h.invoiceSchemes.map((x) => [x.id, x]));
  const schemeFor = (loc: string) => scheme.get(h.locations.find((l) => l.id === loc)!.invoiceSchemeId)!;

  const salesPayMethod = (): PaymentMethod => {
    const x = r.next();
    return x < 0.52 ? "cash" : x < 0.64 ? "card" : x < 0.84 ? "custom_pay_1" : "custom_pay_2";
  };

  type PendingReturn = { sale: Transaction; day: string };
  const pendingReturns: PendingReturn[] = [];
  const registerUse = new Map<string, { userId: string; locationId: string; date: string; cash: number; card: number; cheque: number }>();

  // ── Builders ─────────────────────────────────────────────────────────
  const purchase = (loc: string, date: string, status: "received" | "pending" | "ordered") => {
    const pool = atLoc[loc]
      .map((v) => ({ v, ratio: avail(loc, v.id) / target(v) }))
      .sort((a, b) => a.ratio - b.ratio);
    const low = pool.filter((x) => x.ratio < 0.5);
    const picked = (low.length ? low : pool.slice(0, 2)).slice(0, 10).filter(() => r.chance(0.7)).slice(0, r.int(2, 6));
    if (!picked.length) picked.push(pool[0]);
    const supplier = r.pick(loc === LOC_RANGO ? suppliersE : suppliersF);
    const tid = id("t");
    const at = ts(date, r.int(9, 12));
    const lines: LineIn[] = picked.map(({ v }) => {
      const p = productById.get(v.productId)!;
      const t = target(v);
      const need = t * (0.9 + r.next() * 0.3) - avail(loc, v.id);
      const qty = isKg(p) ? Math.max(4, Math.round(need / 50)) * 50 : Math.max(1, Math.round(need));
      const unitPrice = roundMoney(v.purchasePriceExc * (0.97 + r.next() * 0.06), 0);
      const taxRate = taxRateOf(p.taxId);
      const discount: DiscountInput | null = r.chance(0.15) ? { type: "percentage", amount: r.pick([1, 2, 3]) } : null;
      const lt = lineTotals({ qty, unitPrice, taxRate, taxType: "exclusive", discount: discount ?? undefined });
      return {
        id: id("l"), productId: p.id, variationId: v.id, unitId: p.unitId, qty, unitPrice, taxId: p.taxId, taxRate,
        taxType: "exclusive", discount, subtotal: lt.subtotal, unitCost: roundMoney(lt.unitExc - lt.discountPerUnit),
        lotNo: isKg(p) ? `L${date.replace(/-/g, "").slice(2)}${r.int(10, 99)}` : "",
        expDate: expiryFor(p, date), sellPriceInc: v.sellPriceInc,
      };
    });
    const shipping = r.chance(0.4) ? r.pick([300, 500, 800, 1200, 1500]) : 0;
    const additional = r.chance(0.15) ? [{ name: "Labour", amount: r.pick([200, 400, 600]) }] : [];
    const totals = orderTotals({
      lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate ?? 0, taxType: "exclusive", discount: l.discount ?? undefined })),
      shipping, additionalExpenses: additional.map((a) => a.amount),
    });
    const payments: PaymentIn[] = [];
    if (status === "received") {
      const x = r.next();
      const amount = x < 0.55 ? totals.total : x < 0.8 ? roundMoney(totals.total * (0.3 + r.next() * 0.5), 0) : 0;
      if (amount > 0) {
        const m = r.next();
        payments.push(pay(tid, s.prefixes.purchasePayment, amount, m < 0.5 ? "bank_transfer" : m < 0.85 ? "cash" : "cheque", at, false, SEED_USER));
      }
      // settle part of the rest later
      if (amount < totals.total && r.chance(0.5)) {
        const later = plusDays(date, r.int(5, 40));
        if (later <= h.today) payments.push(pay(tid, s.prefixes.purchasePayment, roundMoney(totals.total - amount), "bank_transfer", ts(later, 11), false, SEED_USER));
      }
      for (const l of lines) {
        const p = productById.get(l.productId)!;
        addLot({ id: id("lot"), locationId: loc, variationId: l.variationId, productId: p.id, sourceTxnId: tid, qtyIn: l.qty, qtyRemaining: l.qty, unitCost: l.unitCost ?? 0, receivedAt: at, lotNo: l.lotNo, expDate: l.expDate });
      }
    }
    return push({
      id: tid, createdAt: at, createdBy: SEED_USER, type: "purchase", status, locationId: loc, contactId: supplier.id,
      refNo: ref(s.prefixes.purchase, date), date: at, lines,
      shipping: { details: shipping ? "Truck fare" : "", charges: shipping }, additionalExpenses: additional,
      totals, payments, paymentStatus: statusOf(totals.total, payments, at, supplier.payTerm), payTerm: supplier.payTerm,
    });
  };

  const sell = (loc: string, date: string) => {
    const channel = r.chance(0.65) ? "pos" : "web";
    const createdBy = r.pick(staffAt[loc][channel]);
    const customer = r.chance(channel === "pos" ? 0.55 : 0.3) ? null : r.pick(customers);
    const contactId = customer?.id ?? WALK_IN;
    const statusRoll = r.next();
    const status = statusRoll < 0.85 ? "final" : statusRoll < 0.95 ? "draft" : "quotation";
    const at = ts(date, r.int(9, 20));
    const tid = id("t");
    const group = customer?.customerGroupId ? groupById.get(customer.customerGroupId) : null;

    const n = loc === LOC_NIPUN ? r.int(1, 4) : r.int(1, 3);
    const chosen = new Set<string>();
    const lines: LineIn[] = [];
    for (let i = 0; i < n; i++) {
      let v = r.pick(atLoc[loc]);
      if (v.sellPriceExc > 20000 && r.chance(0.5)) v = r.pick(atLoc[loc]);
      if (chosen.has(v.id)) continue;
      chosen.add(v.id);
      const p = productById.get(v.productId)!;
      let qty = isKg(p) ? r.pick([25, 50, 50, 100, 150, 200]) : p.unitId === "unit_pack" || p.unitId === "unit_ltr" ? r.int(1, 5) : v.sellPriceExc < 600 ? r.int(1, 4) : r.chance(0.1) ? 2 : 1;
      if (status === "final") {
        const a = avail(loc, v.id);
        if (a < qty) qty = isKg(p) ? Math.floor(a / 25) * 25 : Math.floor(a);
        if (qty <= 0) continue;
      }
      const taxRate = taxRateOf(p.taxId);
      const base = p.taxType === "inclusive" ? v.sellPriceInc : v.sellPriceExc;
      const unitPrice = p.taxId ? base : resolveUnitPrice({ defaultPrice: base, groupPrices: v.groupPrices, customerGroup: group ?? null });
      const discount: DiscountInput | null = v.sellPriceExc > 5000 && r.chance(0.12) ? { type: "percentage", amount: r.pick([2, 3, 5]) } : null;
      const lt = lineTotals({ qty, unitPrice, taxRate, taxType: p.taxType, discount: discount ?? undefined });
      let unitCost = v.purchasePriceExc;
      let allocations: { lotId: string; qty: number; unitCost: number }[] = [];
      if (status === "final") {
        const res = take(loc, v.id, qty);
        allocations = res.allocations;
        unitCost = roundMoney(res.cost / qty);
      }
      const serials = p.enableSerial && status === "final" ? Array.from({ length: qty }, () => `35${r.int(1e12, 9.99e12)}`) : [];
      lines.push({
        id: id("l"), productId: p.id, variationId: v.id, unitId: p.unitId, qty, unitPrice, taxId: p.taxId, taxRate,
        taxType: p.taxType, discount, subtotal: lt.subtotal, unitCost, allocations, serials,
      });
    }
    if (!lines.length) return null;

    const lineInputs = lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate ?? 0, taxType: l.taxType ?? "exclusive", discount: l.discount ?? undefined }));
    const preTotal = orderTotals({ lines: lineInputs }).total;
    const discount: DiscountInput | null = r.chance(0.15)
      ? r.chance(0.5) ? { type: "fixed", amount: Math.min(r.pick([20, 50, 100, 200, 500]), roundMoney(preTotal * 0.05, 0)) } : { type: "percentage", amount: r.pick([2, 3]) }
      : null;

    const shipZone = channel === "web" && customer && r.chance(0.25) ? (loc === LOC_NIPUN || r.chance(0.3) ? "outside_dhaka" : "inside_dhaka") : null;
    const shippingCharge = shipZone === "outside_dhaka" ? 120 : shipZone === "inside_dhaka" ? 60 : 0;

    let redeemedPts = 0;
    const balance = customer ? points.get(customer.id) ?? 0 : 0;
    if (customer && status === "final" && r.chance(0.3)) redeemedPts = maxRedeemable({ total: preTotal, balance, s: s.rewards });

    const totals = orderTotals({
      lines: lineInputs, discount: discount ?? undefined, shipping: shippingCharge,
      rounding: s.sale.roundingMethod, pointsRedeemed: redeemValue(redeemedPts, s.rewards),
    });

    const payments: PaymentIn[] = [];
    let earned = 0;
    let refNo: string;
    if (status === "final") {
      const sch = schemeFor(loc);
      refNo = nextInvoiceNo(sch, r.next);
      sch.count += 1;
      const x = r.next();
      const amount = !customer || x < 0.7 ? totals.total : x < 0.88 ? roundMoney(totals.total * (0.2 + r.next() * 0.6), 0) : 0;
      if (amount > 0) {
        if (amount >= 1000 && r.chance(0.12)) {
          const first = roundMoney(amount * r.pick([0.3, 0.5, 0.6]), 0);
          payments.push(pay(tid, s.prefixes.sellPayment, first, "cash", at, true, createdBy));
          payments.push(pay(tid, s.prefixes.sellPayment, roundMoney(amount - first), r.pick(["custom_pay_1", "custom_pay_2", "card"] as const), at, true, createdBy));
        } else {
          payments.push(pay(tid, s.prefixes.sellPayment, amount, salesPayMethod(), at, true, createdBy));
        }
      }
      if (customer && amount < totals.total && r.chance(0.55)) {
        const later = plusDays(date, r.int(3, 35));
        if (later <= h.today) payments.push(pay(tid, s.prefixes.sellPayment, roundMoney(totals.total - amount), r.pick(["cash", "custom_pay_1", "bank_transfer"] as const), ts(later, r.int(10, 19)), true, SEED_USER));
      }
      if (customer) {
        earned = pointsEarned(totals.total, s.rewards);
        points.set(customer.id, balance - redeemedPts + earned);
      }
      if (channel === "pos") {
        const k = `${createdBy}|${loc}|${date}`;
        const reg = registerUse.get(k) ?? { userId: createdBy, locationId: loc, date, cash: 0, card: 0, cheque: 0 };
        for (const p of payments) {
          if (p.paidOn !== at) continue;
          if (p.method === "cash") reg.cash = roundMoney(reg.cash + p.amount);
          if (p.method === "card") reg.card += 1;
          if (p.method === "cheque") reg.cheque += 1;
        }
        registerUse.set(k, reg);
      }
    } else {
      refNo = ref(s.prefixes.draft, date);
    }

    const agent = loc === LOC_RANGO
      ? agentIds.has(createdBy) ? createdBy : r.chance(0.2) ? r.pick(["user_sales1", "user_sales2"]) : null
      : r.chance(0.3) ? "user_sales3" : null;
    const hasPhone = lines.some((l) => productById.get(l.productId)!.categoryId === "cat_mobile");
    const ageDays = (todayDate.getTime() - parseISO(date).getTime()) / 86_400_000;

    const tx = push({
      id: tid, createdAt: at, createdBy, type: "sell", status, channel, locationId: loc, contactId, refNo, date: at, lines,
      discount, pointsRedeemed: redeemedPts, pointsEarned: earned,
      shipping: shipZone
        ? {
            zone: shipZone, charges: shippingCharge, address: customer ? `${customer.address.line1}, ${customer.address.line2}, ${customer.address.city}` : "",
            details: shipZone === "outside_dhaka" ? "Sundarban Courier" : "Pathao",
            status: ageDays > 5 ? (r.chance(0.92) ? "delivered" : "cancelled") : r.pick(["ordered", "packed", "shipped"] as const),
            deliveredTo: ageDays > 5 ? customer?.name ?? "" : "",
          }
        : {},
      totals, payments, paymentStatus: status === "final" ? statusOf(totals.total, payments, at, customer?.payTerm) : "due",
      payTerm: customer?.payTerm ?? null, invoiceSchemeId: status === "final" ? schemeFor(loc).id : null,
      commissionAgentId: status === "final" ? agent : null,
      technicianId: hasPhone && r.chance(0.2) ? r.pick(["tech_1", "tech_2", "tech_3"]) : null,
      notes: status === "quotation" ? "Price valid for 7 days." : "",
    });
    if (status === "final" && customer && r.chance(0.035)) {
      const day = plusDays(date, r.int(1, 10));
      if (day <= h.today) pendingReturns.push({ sale: tx, day });
    }
    return tx;
  };

  const sellReturn = ({ sale, day }: PendingReturn) => {
    const line = sale.lines[0];
    const p = productById.get(line.productId)!;
    const qty = isKg(p) ? Math.min(line.qty, 25) : 1;
    const at = ts(day, r.int(10, 18));
    const tid = id("t");
    const lt = lineTotals({ qty, unitPrice: line.unitPrice, taxRate: line.taxRate, taxType: line.taxType, discount: line.discount ?? undefined });
    const totals = orderTotals({ lines: [{ qty, unitPrice: line.unitPrice, taxRate: line.taxRate, taxType: line.taxType, discount: line.discount ?? undefined }] });
    line.returnedQty = qty;
    addLot({ id: id("lot"), locationId: sale.locationId, variationId: line.variationId, productId: p.id, sourceTxnId: tid, qtyIn: qty, qtyRemaining: qty, unitCost: line.unitCost, receivedAt: at, expDate: line.allocations[0] ? lotById.get(line.allocations[0].lotId)?.expDate ?? null : null });
    const refunded = sale.paymentStatus === "paid";
    const payments = refunded ? [pay(tid, s.prefixes.sellPayment, totals.total, "cash", at, false, SEED_USER)] : [];
    push({
      id: tid, createdAt: at, createdBy: SEED_USER, type: "sell_return", status: "final", locationId: sale.locationId,
      contactId: sale.contactId, refNo: ref(s.prefixes.sellReturn, day), date: at, parentId: sale.id,
      lines: [{ id: id("l"), productId: p.id, variationId: line.variationId, unitId: line.unitId, qty, unitPrice: line.unitPrice, taxId: line.taxId, taxRate: line.taxRate, taxType: line.taxType, discount: line.discount, subtotal: lt.subtotal, unitCost: line.unitCost, parentLineId: line.id }],
      totals, payments, paymentStatus: refunded ? "paid" : "due", notes: r.pick(["Defective unit", "Customer changed mind", "Wrong item delivered", "Packet damaged"]),
    });
  };

  const purchaseReturn = (date: string) => {
    const candidates = transactions.filter((t) => t.type === "purchase" && t.status === "received" && t.date.slice(0, 10) <= plusDays(date, -7));
    for (let tries = 0; tries < 10; tries++) {
      const pur = r.pick(candidates.slice(-30));
      if (!pur) return;
      const line = r.pick(pur.lines);
      const lot = stockLots.find((l) => l.sourceTxnId === pur.id && l.variationId === line.variationId);
      if (!lot) continue;
      const p = productById.get(line.productId)!;
      const qty = isKg(p) ? Math.floor((lot.qtyRemaining * 0.2) / 50) * 50 : Math.floor(lot.qtyRemaining * 0.25);
      if (qty <= 0) continue;
      lot.qtyRemaining = roundMoney(lot.qtyRemaining - qty, 4);
      const at = ts(date, r.int(10, 17));
      const tid = id("t");
      const totals = orderTotals({ lines: [{ qty, unitPrice: lot.unitCost, taxRate: line.taxRate, taxType: "exclusive" }] });
      const refunded = r.chance(0.7);
      const payments = refunded ? [pay(tid, s.prefixes.purchasePayment, totals.total, "bank_transfer", at, true, SEED_USER)] : [];
      push({
        id: tid, createdAt: at, createdBy: SEED_USER, type: "purchase_return", status: "final", locationId: pur.locationId,
        contactId: pur.contactId, refNo: ref(s.prefixes.purchaseReturn, date), date: at, parentId: pur.id,
        lines: [{ id: id("l"), productId: p.id, variationId: line.variationId, unitId: line.unitId, qty, unitPrice: lot.unitCost, taxId: line.taxId, taxRate: line.taxRate, taxType: "exclusive", subtotal: totals.linesTotal, unitCost: lot.unitCost, allocations: [{ lotId: lot.id, qty, unitCost: lot.unitCost }], parentLineId: line.id }],
        totals, payments, paymentStatus: refunded ? "paid" : "due", notes: r.pick(["Damaged packaging", "Quality issue", "Excess quantity"]),
      });
      return;
    }
  };

  const shared = stockVariations.filter((v) => productById.get(v.productId)!.locationIds.length > 1);
  const transfer = (date: string, status: "completed" | "pending" | "in_transit") => {
    const from = r.chance(0.6) ? LOC_RANGO : LOC_NIPUN;
    const to = from === LOC_RANGO ? LOC_NIPUN : LOC_RANGO;
    const at = ts(date, r.int(9, 16));
    const tid = id("t");
    const lines: LineIn[] = [];
    for (const v of r.shuffle(shared).slice(0, r.int(1, 3))) {
      const a = avail(from, v.id);
      const qty = Math.min(r.int(5, 20), Math.floor(a / 2));
      if (qty <= 0) continue;
      const p = productById.get(v.productId)!;
      let unitCost = v.purchasePriceExc;
      let allocations: { lotId: string; qty: number; unitCost: number }[] = [];
      if (status !== "pending") {
        const res = take(from, v.id, qty);
        allocations = res.allocations;
        unitCost = roundMoney(res.cost / qty);
      }
      if (status === "completed") {
        for (const al of allocations) {
          addLot({ id: id("lot"), locationId: to, variationId: v.id, productId: p.id, sourceTxnId: tid, qtyIn: al.qty, qtyRemaining: al.qty, unitCost: al.unitCost, receivedAt: at, expDate: lotById.get(al.lotId)?.expDate ?? null });
        }
      }
      lines.push({ id: id("l"), productId: p.id, variationId: v.id, unitId: p.unitId, qty, unitPrice: unitCost, subtotal: roundMoney(unitCost * qty), unitCost, allocations });
    }
    if (!lines.length) return;
    const shipping = r.chance(0.5) ? r.pick([150, 250, 300]) : 0;
    const totals = orderTotals({ lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: 0, taxType: "exclusive" })), shipping });
    push({
      id: tid, createdAt: at, createdBy: SEED_USER, type: "stock_transfer", status, locationId: from, transferLocationId: to,
      refNo: ref(s.prefixes.stockTransfer, date), date: at, lines, shipping: { charges: shipping }, totals, paymentStatus: "paid",
      notes: "Rebalancing stock between branches",
    });
  };

  const adjustment = (date: string) => {
    const loc = r.chance(0.5) ? LOC_RANGO : LOC_NIPUN;
    const at = ts(date, r.int(9, 18));
    const tid = id("t");
    const lines: LineIn[] = [];
    for (const v of r.shuffle(atLoc[loc]).slice(0, r.int(1, 2))) {
      const p = productById.get(v.productId)!;
      const a = avail(loc, v.id);
      const qty = isKg(p) ? Math.min(50, Math.floor(a / 50) * 25) : Math.min(r.int(1, 2), Math.floor(a));
      if (qty <= 0) continue;
      const res = take(loc, v.id, qty);
      const unitCost = roundMoney(res.cost / qty);
      lines.push({ id: id("l"), productId: p.id, variationId: v.id, unitId: p.unitId, qty, unitPrice: unitCost, subtotal: res.cost, unitCost, allocations: res.allocations });
    }
    if (!lines.length) return;
    const totals = orderTotals({ lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: 0, taxType: "exclusive" })) });
    const abnormal = r.chance(0.4);
    push({
      id: tid, createdAt: at, createdBy: SEED_USER, type: "stock_adjustment", status: "final", locationId: loc,
      refNo: ref(s.prefixes.stockAdjustment, date), date: at, lines, totals, paymentStatus: "paid",
      adjustmentType: abnormal ? "abnormal" : "normal", amountRecovered: abnormal && r.chance(0.5) ? roundMoney(totals.total * 0.3, 0) : 0,
      notes: loc === LOC_NIPUN ? r.pick(["Bag torn by rats", "Moisture damage", "Expired stock written off"]) : r.pick(["Damaged in display", "Missing during stock count", "Broken screen on arrival"]),
    });
  };

  const expense = (date: string, loc: string, categoryId: string, amount: number, note: string, opts: { recurring?: boolean; forUser?: string; method?: PaymentMethod; sub?: string } = {}) => {
    const at = ts(date, r.int(10, 18));
    const tid = id("t");
    const unpaid = r.chance(0.08);
    const paid = unpaid ? (r.chance(0.5) ? roundMoney(amount * 0.5, 0) : 0) : amount;
    const payments = paid > 0 ? [pay(tid, s.prefixes.expensePayment, paid, opts.method ?? (amount > 10000 ? "bank_transfer" : "cash"), at, false, SEED_USER)] : [];
    const totals = { itemsCount: 0, linesTotal: amount, discount: 0, orderTax: 0, shipping: 0, additional: 0, redeemed: 0, roundOff: 0, total: amount };
    push({
      id: tid, createdAt: at, createdBy: SEED_USER, type: "expense", status: "final", locationId: loc,
      refNo: ref(s.prefixes.expense, date), date: at, lines: [], totals, payments,
      paymentStatus: statusOf(amount, payments, at, null), expenseCategoryId: opts.sub ? categoryId : categoryId,
      expenseSubCategoryId: opts.sub ?? null, expenseForUserId: opts.forUser ?? null, notes: note,
      recurring: opts.recurring ? { interval: 1, intervalType: "months", repetitions: null, repeatOn: 1, parentId: null } : null,
    });
  };

  // ── Day loop ─────────────────────────────────────────────────────────
  let transferCount = 0;
  let adjustmentCount = 0;
  let purchaseReturnCount = 0;
  for (let n = h.days; n >= 0; n--) {
    const date = dayStr(n);
    const dom = Number(date.slice(8, 10));
    const idx = h.days - n;

    if (r.chance(0.5)) purchase(r.chance(0.6) ? LOC_RANGO : LOC_NIPUN, date, n <= 7 && r.chance(0.4) ? r.pick(["pending", "ordered"] as const) : "received");
    if (idx % 30 === 3) purchase(LOC_NIPUN, date, "received");

    for (const pr of pendingReturns.filter((x) => x.day === date)) sellReturn(pr);

    const count: Record<string, number> = { [LOC_RANGO]: r.int(1, 4), [LOC_NIPUN]: r.int(1, 3) };
    for (const loc of [LOC_RANGO, LOC_NIPUN]) for (let i = 0; i < count[loc]; i++) sell(loc, date);

    if (idx % 12 === 5 && transferCount < 15) {
      transfer(date, n <= 3 ? (transferCount % 2 ? "pending" : "in_transit") : "completed");
      transferCount++;
    }
    if (idx % 15 === 7 && adjustmentCount < 12) {
      adjustment(date);
      adjustmentCount++;
    }
    if (idx % 18 === 9 && purchaseReturnCount < 10) {
      purchaseReturn(date);
      purchaseReturnCount++;
    }

    // Monthly expenses
    if (dom === 1) {
      expense(date, LOC_RANGO, "exp_rent", 35000, "Shop rent – Shah Ali Plaza", { recurring: true });
      expense(date, LOC_NIPUN, "exp_rent", 18000, "Warehouse rent – Bhaluka", { recurring: true });
    }
    if (dom === 3) {
      expense(date, LOC_RANGO, "exp_salary", 62000, "Monthly staff salaries", { forUser: "user_manager", method: "bank_transfer" });
      expense(date, LOC_NIPUN, "exp_salary", 32000, "Monthly staff salaries", { forUser: "user_nipun", method: "bank_transfer" });
    }
    if (dom === 5) {
      expense(date, LOC_RANGO, "exp_utility", r.money(5500, 9000), "DESCO electricity bill", { sub: "exp_electricity", method: "custom_pay_1" });
      expense(date, LOC_NIPUN, "exp_utility", r.money(3000, 5500), "Palli Bidyut bill", { sub: "exp_electricity", method: "custom_pay_1" });
      expense(date, LOC_RANGO, "exp_utility", 1500, "Broadband – Link3", { sub: "exp_internet", recurring: true });
    }
    if (r.chance(0.3)) {
      const [cat, lo, hi, note] = r.pick([
        ["exp_transport", 300, 2500, "Delivery van fare"],
        ["exp_snacks", 150, 600, "Tea and snacks for staff"],
        ["exp_maintenance", 500, 5000, "Shop maintenance"],
        ["exp_office", 200, 1500, "Receipt paper and stationery"],
        ["exp_marketing", 1000, 5000, "Facebook boost"],
      ] as const);
      expense(date, r.chance(0.6) ? LOC_RANGO : LOC_NIPUN, cat, r.money(lo, hi), note);
    }

    // Weekly: sweep excess cash and MFS balances into the bank
    if (idx % 7 === 6) {
      for (const acc of [ACC.cash, ACC.bkash, ACC.nagad]) {
        const excess = Math.floor(((balances.get(acc) ?? 0) - (acc === ACC.cash ? 40000 : 10000)) / 1000) * 1000;
        if (excess > 0) {
          const pairId = id("ft");
          const at = `${date}T20:30:00`;
          ledger(acc, "debit", "fund_transfer", excess, at, { transferPairId: pairId, note: "Deposit to City Bank" });
          ledger(ACC.bank, "credit", "fund_transfer", excess, at, { transferPairId: pairId, note: "Deposit to City Bank" });
        }
      }
    }
  }

  // ── A few sales orders ───────────────────────────────────────────────
  for (let i = 0; i < 18; i++) {
    const n = r.int(0, h.days);
    const date = dayStr(n);
    const loc = r.chance(0.5) ? LOC_RANGO : LOC_NIPUN;
    const customer = r.pick(customers.filter((c) => c.kind === "business"));
    const at = ts(date, r.int(10, 17));
    const lines: LineIn[] = r.shuffle(atLoc[loc]).slice(0, r.int(1, 3)).map((v) => {
      const p = productById.get(v.productId)!;
      const qty = isKg(p) ? r.pick([500, 1000, 1500]) : r.int(2, 10);
      const unitPrice = p.taxType === "inclusive" ? v.sellPriceInc : v.sellPriceExc;
      const lt = lineTotals({ qty, unitPrice, taxRate: taxRateOf(p.taxId), taxType: p.taxType });
      return { id: id("l"), productId: p.id, variationId: v.id, unitId: p.unitId, qty, unitPrice, taxId: p.taxId, taxRate: taxRateOf(p.taxId), taxType: p.taxType, subtotal: lt.subtotal };
    });
    const totals = orderTotals({ lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate ?? 0, taxType: l.taxType ?? "exclusive" })) });
    push({
      id: id("t"), createdAt: at, createdBy: SEED_USER, type: "sales_order", status: n > 20 ? "completed" : n > 10 ? "partial" : "ordered",
      locationId: loc, contactId: customer.id, refNo: ref(s.prefixes.salesOrder, date), date: at, lines, totals, paymentStatus: "due",
      payTerm: customer.payTerm,
    });
  }

  // Suspended POS carts today
  for (const loc of [LOC_RANGO, LOC_NIPUN]) {
    const v = r.pick(atLoc[loc]);
    const p = productById.get(v.productId)!;
    const qty = isKg(p) ? 50 : 1;
    const unitPrice = p.taxType === "inclusive" ? v.sellPriceInc : v.sellPriceExc;
    const lt = lineTotals({ qty, unitPrice, taxRate: taxRateOf(p.taxId), taxType: p.taxType });
    const at = ts(h.today, 10);
    push({
      id: id("t"), createdAt: at, createdBy: loc === LOC_RANGO ? "user_cashier" : "user_nipun", type: "sell", status: "suspended", channel: "pos",
      locationId: loc, contactId: WALK_IN, refNo: ref(s.prefixes.draft, h.today), date: at,
      lines: [{ id: id("l"), productId: p.id, variationId: v.id, unitId: p.unitId, qty, unitPrice, taxId: p.taxId, taxRate: taxRateOf(p.taxId), taxType: p.taxType, subtotal: lt.subtotal }],
      totals: orderTotals({ lines: [{ qty, unitPrice, taxRate: taxRateOf(p.taxId), taxType: p.taxType }] }), paymentStatus: "due",
      staffNote: "Customer went to ATM",
    });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  // ── Cash registers ───────────────────────────────────────────────────
  const cashRegisters = [...registerUse.values()]
    .sort((a, b) => (a.date + a.userId).localeCompare(b.date + b.userId))
    .map((reg) => {
      const opening = r.pick([1000, 2000, 3000, 5000]);
      const isToday = reg.date === h.today;
      return mk(cashRegister, {
        id: id("reg"), createdAt: `${reg.date}T09:00:00`, createdBy: reg.userId, userId: reg.userId, locationId: reg.locationId,
        openedAt: `${reg.date}T09:00:00`, closedAt: isToday ? null : `${reg.date}T21:${String(r.int(0, 45)).padStart(2, "0")}:00`,
        openingCash: opening, closingAmount: isToday ? null : roundMoney(opening + reg.cash), totalCardSlips: reg.card, totalCheques: reg.cheque,
        closingNote: isToday ? "" : r.pick(["", "", "All good", "Short by ৳10, adjusted"]), status: isToday ? "open" : "close",
      });
    });

  // Write reward balances back onto contacts
  for (const c of h.contacts) if (points.has(c.id)) c.points = Math.max(0, points.get(c.id)!);

  // Alerts (low stock, overdue, expiring...) are derived from the data at runtime; only the welcome note is seeded.
  const notifications: Notification[] = [
    mk(notification, { id: id("n"), createdAt: `${h.today}T09:00:00`, createdBy: null, title: "Welcome to POS-sible", body: "Your demo business is ready with 6 months of sample data.", kind: "success", href: "/home" }),
  ];

  return { transactions, stockLots, accountTxns, cashRegisters, notifications, counters };
}
