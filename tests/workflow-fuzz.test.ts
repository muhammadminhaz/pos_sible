import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { AppError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { addItem, emptyCart, setContact } from "@/lib/pos/cart";
import { ledgerReportsService } from "@/lib/data/services/ledgerReports";
import { moneyReports } from "@/lib/data/services/reports/money";
import { adjustmentsService } from "@/lib/data/services/adjustments";
import { expensesService } from "@/lib/data/services/expenses";
import { posService, toCartItem } from "@/lib/data/services/pos";
import { purchasesService } from "@/lib/data/services/purchases";
import { purchaseReturnsService } from "@/lib/data/services/purchaseReturns";
import { registersService } from "@/lib/data/services/registers";
import { returnsService } from "@/lib/data/services/returns";
import { salesService } from "@/lib/data/services/sales";
import { transfersService } from "@/lib/data/services/transfers";

const seed = createSeed({ seed: 7, today: "2026-09-28" });

function rng(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Walks the whole database looking for numbers that went bad. */
function badNumbers(v: unknown, path = "db"): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? null : path;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) { const r = badNumbers(v[i], `${path}[${i}]`); if (r) return r; }
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { const r = badNumbers(x, `${path}.${k}`); if (r) return r; }
  }
  return null;
}

async function invariants(): Promise<string[]> {
  const d = getDB();
  const bad: string[] = [];
  const nb = badNumbers(d.transactions) ?? badNumbers(d.stockLots) ?? badNumbers(d.accountTxns);
  if (nb) bad.push(`non-finite number at ${nb}`);
  for (const l of d.stockLots) {
    if (l.qtyRemaining < -1e-6) bad.push(`negative stock in lot ${l.id}: ${l.qtyRemaining}`);
    if (l.qtyRemaining > l.qtyIn + 1e-6) bad.push(`lot ${l.id} has more left (${l.qtyRemaining}) than came in (${l.qtyIn})`);
  }
  const accounts = new Set(d.accounts.map((a) => a.id));
  const payments = new Set(d.transactions.flatMap((t) => t.payments.map((p) => p.id)));
  for (const a of d.accountTxns) {
    if (!accounts.has(a.accountId)) bad.push(`account txn ${a.id} points at a missing account`);
    if (a.paymentId && !payments.has(a.paymentId)) bad.push(`account txn ${a.id} points at a payment that no longer exists`);
  }
  const refs = new Set<string>();
  for (const t of d.transactions) {
    if (t.type === "sell" && t.status === "suspended") continue;
    const key = `${t.type}:${t.refNo}`;
    if (refs.has(key)) bad.push(`duplicate reference ${key}`);
    refs.add(key);
  }
  for (const t of d.transactions) {
    if (t.parentId && !d.transactions.some((p) => p.id === t.parentId)) bad.push(`${t.type} ${t.refNo} lost its parent`);
  }
  // The books must reconcile with the stock room and with each other.
  const near = (a: number, b: number) => Math.abs(a - b) < 0.011;
  const tb = await ledgerReportsService.trialBalance({});
  if (!near(tb.debit, tb.credit)) bad.push(`trial balance is off: debit ${tb.debit} vs credit ${tb.credit}`);
  const bs = await ledgerReportsService.balanceSheet({});
  if (!near(bs.totalAssets, bs.totalLiabilities + bs.totalEquity)) bad.push(`balance sheet is off: assets ${bs.totalAssets} vs ${bs.totalLiabilities + bs.totalEquity}`);
  const inventory = bs.assets.filter((a) => a.account === "inventory").reduce((n, a) => n + a.amount, 0);
  // Goods in transit have left the source lots but are still the business's inventory.
  const inTransit = d.transactions.filter((t) => t.type === "stock_transfer" && t.status === "in_transit").reduce((n, t) => n + t.lines.reduce((m, l) => m + l.qty * l.unitCost, 0), 0);
  const lotsValue = d.stockLots.reduce((n, l) => n + l.qtyRemaining * l.unitCost, 0) + inTransit;
  if (!near(inventory, lotsValue)) bad.push(`inventory on the balance sheet (${inventory}) differs from the stock lots (${lotsValue.toFixed(2)})`);
  const pl = await moneyReports.profitLoss({});
  const tbCogs = tb.rows.filter((r) => r.account === "cogs").reduce((n, r) => n + r.debit - r.credit, 0);
  if (!near(pl.cogs, tbCogs)) bad.push(`P&L cost of goods (${pl.cogs}) differs from the ledger (${tbCogs})`);
  return bad;
}

describe("workflow fuzz: random user actions never corrupt the books", () => {
  beforeEach(async () => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
    commit((d) => {
      d.settings.business.transactionEditDays = 0; // allow editing seeded history
      for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    });
    await registersService.open(LOC_RANGO, 1000);
  });

  for (const seedNo of [1, 2, 3, 4, 5]) {
    it(`seed ${seedNo}: 200 random operations`, async () => {
      const rand = rng(seedNo * 1000 + 17);
      const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
      const stocked = async (loc: string) => (await posService.products({ locationId: loc, pageSize: -1 })).rows.filter((x) => x.manageStock && !x.enableSerial);
      const log: string[] = [];

      const ops: Record<string, () => Promise<unknown>> = {
        async purchase() {
          const d = getDB();
          const supplier = pick(d.contacts.filter((c) => c.type !== "customer"));
          const loc = pick([LOC_RANGO, LOC_NIPUN]);
          const p = pick(await stocked(loc)); const v = p.variations[0];
          const qty = 1 + Math.floor(rand() * 20); const cost = 10 + Math.floor(rand() * 500);
          return purchasesService.save({
            locationId: loc, contactId: supplier.id, date: "2026-09-29T10:00:00", status: pick(["received", "received", "pending"] as const),
            lines: [{ productId: p.id, variationId: v.id, qty, unitPrice: cost, discount: null, taxId: null, lotNo: "", mfgDate: null, expDate: null, sellPriceInc: null }],
            discount: null, orderTaxId: null, shipping: { charges: 0, details: "" }, additionalExpenses: [], exchangeRate: 1, payTerm: null, notes: "", documents: [],
            payments: rand() < 0.5 ? [{ method: "cash", amount: Math.floor(qty * cost * rand()) }] : [],
          });
        },
        async sale() {
          const d = getDB();
          const loc = pick([LOC_RANGO, LOC_NIPUN]);
          const p = pick(await stocked(loc)); const v = p.variations[0];
          if (!v.stock) throw new AppError("no stock", "skip");
          const qty = Math.min(v.stock, 1 + Math.floor(rand() * 5));
          const customer = pick(d.contacts.filter((c) => c.type !== "supplier"));
          let cart = setContact(addItem(emptyCart(), toCartItem(p, v, qty), "new_row"), customer.id);
          cart = { ...cart };
          const status = pick(["final", "final", "final", "draft", "suspended", "quotation"] as const);
          return salesService.checkout({ cart, locationId: loc, status, payments: status === "final" ? [{ method: "cash", amount: Math.floor(v.unitPrice * qty * (0.5 + rand())) }] : [] });
        },
        async removeSale() {
          const sells = getDB().transactions.filter((t) => t.type === "sell");
          return salesService.removeAny(pick(sells).id);
        },
        async salePayment() {
          const sells = getDB().transactions.filter((t) => t.type === "sell" && t.status === "final");
          return salesService.addPayment(pick(sells).id, { method: "cash", amount: 1 + Math.floor(rand() * 500) });
        },
        async sellReturn() {
          const sale = pick(getDB().transactions.filter((t) => t.type === "sell" && t.status === "final"));
          const lines = (await returnsService.parentLines(sale.id)).filter((l) => l.soldQty - l.returnedQty > 0);
          if (!lines.length) throw new AppError("nothing to return", "skip");
          const l = pick(lines);
          return returnsService.create({ parentId: sale.id, lines: [{ lineId: l.lineId, qty: Math.max(1, Math.floor((l.soldQty - l.returnedQty) * rand())) }] });
        },
        async editSale() {
          const sale = pick(getDB().transactions.filter((t) => t.type === "sell" && (t.status === "final" || t.status === "draft")));
          const cart = await salesService.toCart(sale.id, true);
          if (!cart.lines.length) throw new AppError("empty", "skip");
          const l = cart.lines[0];
          const qty = Math.max(1, Math.floor(l.qty * (0.5 + rand())));
          return salesService.save({ id: sale.id, cart: { ...cart, lines: [{ ...l, qty }, ...cart.lines.slice(1)] }, locationId: sale.locationId, status: sale.status as "final" | "draft" });
        },
        async convertDraft() {
          const draft = pick(getDB().transactions.filter((t) => t.type === "sell" && (t.status === "draft" || t.status === "quotation")));
          return salesService.convert(draft.id, [{ method: "cash", amount: 1 }]);
        },
        async editPurchase() {
          const pu = pick(getDB().transactions.filter((t) => t.type === "purchase"));
          const form = await purchasesService.getForm(pu.id);
          const l = form.lines[0];
          return purchasesService.save({ ...form, id: pu.id, lines: [{ ...l, qty: Math.max(1, Math.floor(l.qty * (0.5 + rand() * 1.5))) }, ...form.lines.slice(1)] });
        },
        async purchasePayment() {
          const pu = pick(getDB().transactions.filter((t) => t.type === "purchase"));
          return purchasesService.addPayment(pu.id, { method: "cash", amount: 1 + Math.floor(rand() * 300) });
        },
        async removeTransferOrAdjustment() {
          const t = pick(getDB().transactions.filter((x) => x.type === "stock_transfer" || x.type === "stock_adjustment"));
          return t.type === "stock_transfer" ? transfersService.remove(t.id) : adjustmentsService.remove(t.id);
        },
        async removeExpense() {
          return expensesService.remove(pick(getDB().transactions.filter((t) => t.type === "expense")).id);
        },
        async removePurchase() {
          return purchasesService.remove(pick(getDB().transactions.filter((t) => t.type === "purchase")).id);
        },
        async purchaseReturn() {
          const pu = pick(getDB().transactions.filter((t) => t.type === "purchase" && t.status === "received"));
          const lines = (await purchaseReturnsService.parentLines(pu.id)).filter((l) => l.boughtQty - l.returnedQty > 0);
          if (!lines.length) throw new AppError("nothing to return", "skip");
          const l = pick(lines);
          return purchaseReturnsService.create({ parentId: pu.id, lines: [{ lineId: l.lineId, qty: 1 }] });
        },
        async transfer() {
          const p = pick(await stocked(LOC_RANGO)); const v = p.variations[0];
          if (!getDB().products.find((x) => x.id === p.id)!.locationIds.includes(LOC_NIPUN)) throw new AppError("not at both", "skip");
          return transfersService.create({ fromLocationId: LOC_RANGO, toLocationId: LOC_NIPUN, date: "2026-09-29T10:00:00", status: pick(["pending", "in_transit", "completed"] as const), lines: [{ productId: p.id, variationId: v.id, qty: 1 + Math.floor(rand() * 3) }], shippingCharges: 0, notes: "" });
        },
        async adjustment() {
          const loc = pick([LOC_RANGO, LOC_NIPUN]);
          const p = pick(await stocked(loc));
          return adjustmentsService.create({ locationId: loc, date: "2026-09-29T10:00:00", type: "normal", amountRecovered: 0, reason: "fuzz", lines: [{ productId: p.id, variationId: p.variations[0].id, qty: 1 }] });
        },
        async expense() {
          const d = getDB();
          const cat = pick(d.expenseCategories.filter((c) => !c.parentId));
          return expensesService.save({ locationId: pick([LOC_RANGO, LOC_NIPUN]), categoryId: cat.id, date: "2026-09-29T10:00:00", amount: 10 + Math.floor(rand() * 900), note: "", isRefund: false, payments: rand() < 0.5 ? [{ method: "cash", amount: 10 }] : [] });
        },
      };
      const names = Object.keys(ops);

      for (let i = 0; i < 200; i++) {
        const name = pick(names);
        const before = JSON.stringify(getDB());
        try {
          await ops[name]();
          log.push(`${i} ${name} ok`);
        } catch (e) {
          // A refusal the app would show the user is fine; anything else is a bug.
          if (!(e instanceof AppError)) throw new Error(`op ${i} (${name}) threw a non-app error: ${(e as Error).stack}\n${log.slice(-6).join("\n")}`);
          log.push(`${i} ${name} refused (${(e as AppError).code})`);
          expect(JSON.stringify(getDB()) === before, `a refused ${name} (${(e as AppError).code}) must leave nothing behind`).toBe(true);
        }
        const bad = await invariants();
        expect(bad, `after op ${i} (${name}):\n${bad.join("\n")}\n${log.slice(-8).join("\n")}`).toEqual([]);
      }
      // The run has to actually exercise the app: most operation kinds must have succeeded at least once.
      const okKinds = new Set(log.filter((l) => l.endsWith(" ok")).map((l) => l.split(" ")[1]));
      if (process.env.FUZZ_VERBOSE) console.log(seedNo, [...okKinds].join(","), log.filter((l) => l.includes("refused")).map((l) => l.split(" ").slice(1).join(" ")).reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {}));
      expect(okKinds.size).toBeGreaterThanOrEqual(6);
    }, 120_000);
  }
});