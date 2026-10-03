import { service } from "@/lib/data/api/facade";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { transaction, type DB } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, takeRef, uid } from "../_util";
import { inScope, isFinalSale, names, sumBy, withTotals, type ReportFilter, type ReportResult } from "./_shared";

// ── Stock ───────────────────────────────────────────────────────────────

export type StockFilter = ReportFilter & { categoryId?: string; brandId?: string; unitId?: string; search?: string };
export type StockRow = {
  variationId: string; sku: string; product: string; variation: string; category: string; brand: string; unit: string;
  unitPrice: number; stock: number; valueByCost: number; valueBySale: number; potentialProfit: number;
  sold: number; transferred: number; adjusted: number;
};

/** Stock on hand per variation across the scope (lots counted once), plus units sold, transferred and adjusted in the date range. */
export function stockReport(d: DB, f: StockFilter): ReportResult<StockRow> {
  const lots = d.stockLots.filter((l) => l.qtyRemaining > 0 && (!f.locationId || l.locationId === f.locationId));
  const onHand = new Map<string, { qty: number; cost: number }>();
  for (const l of lots) {
    const x = onHand.get(l.variationId) ?? { qty: 0, cost: 0 };
    onHand.set(l.variationId, { qty: x.qty + l.qtyRemaining, cost: x.cost + l.qtyRemaining * l.unitCost });
  }
  const moved = { sold: new Map<string, number>(), transferred: new Map<string, number>(), adjusted: new Map<string, number>() };
  const add = (m: Map<string, number>, id: string, q: number) => m.set(id, roundMoney((m.get(id) ?? 0) + q, 4));
  for (const t of d.transactions) {
    // A transfer is one document at its source location, so "all locations" counts it once.
    if (!inScope(t, f)) continue;
    const bucket = isFinalSale(t) ? moved.sold : t.type === "sell_return" ? moved.sold : t.type === "stock_transfer" ? moved.transferred : t.type === "stock_adjustment" ? moved.adjusted : null;
    if (bucket) for (const l of t.lines) add(bucket, l.variationId, t.type === "sell_return" ? -l.qty : l.qty);
  }
  const cats = new Map(d.categories.map((c) => [c.id, c.name]));
  const brands = new Map(d.brands.map((b) => [b.id, b.name]));
  const rows = d.variations
    .map((v) => ({ v, p: d.products.find((x) => x.id === v.productId)! }))
    .filter(({ p }) => p && p.manageStock && p.type !== "combo")
    .filter(({ p }) => (!f.categoryId || p.categoryId === f.categoryId) && (!f.brandId || p.brandId === f.brandId) && (!f.unitId || p.unitId === f.unitId))
    .filter(({ v, p }) => !f.search || `${p.name} ${v.name} ${v.sku}`.toLowerCase().includes(f.search.toLowerCase()))
    .map(({ v, p }): StockRow => {
      const h = onHand.get(v.id) ?? { qty: 0, cost: 0 };
      const valueByCost = roundMoney(h.cost);
      const valueBySale = roundMoney(h.qty * v.sellPriceExc);
      return {
        variationId: v.id, sku: v.sku, product: p.name, variation: p.type === "variable" ? v.name : "", category: cats.get(p.categoryId ?? "") ?? "", brand: brands.get(p.brandId ?? "") ?? "",
        unit: d.units.find((u) => u.id === p.unitId)?.shortName ?? "", unitPrice: v.sellPriceInc, stock: roundMoney(h.qty, 4), valueByCost, valueBySale,
        potentialProfit: roundMoney(valueBySale - valueByCost), sold: moved.sold.get(v.id) ?? 0, transferred: moved.transferred.get(v.id) ?? 0, adjusted: moved.adjusted.get(v.id) ?? 0,
      };
    })
    .filter((r) => r.stock > 0 || r.sold || r.transferred || r.adjusted)
    .sort((a, b) => a.product.localeCompare(b.product) || a.variation.localeCompare(b.variation));
  return withTotals(rows, ["stock", "valueByCost", "valueBySale", "potentialProfit", "sold", "transferred", "adjusted"]);
}

// ── Stock expiry ────────────────────────────────────────────────────────

/** Cumulative windows: each includes everything that expires within that many days (expired stock has its own). */
export const EXPIRY_WINDOWS = { expired: -1, week: 7, fortnight: 15, month: 30, quarter: 90, half: 180, year: 365 } as const;
export type ExpiryWindow = keyof typeof EXPIRY_WINDOWS;
export type ExpiryFilter = ReportFilter & { window?: ExpiryWindow; categoryId?: string; brandId?: string; today?: string };
export type ExpiryRow = {
  lotId: string; product: string; variation: string; sku: string; locationName: string; lotNo: string; expDate: string; daysLeft: number; qty: number; value: number; unit: string;
};

export function stockExpiry(d: DB, f: ExpiryFilter): ReportResult<ExpiryRow> {
  const today = f.today ?? todayISO(d.settings.business.timeZone);
  const rows = d.stockLots
    .filter((l) => l.expDate && l.qtyRemaining > 0 && (!f.locationId || l.locationId === f.locationId))
    .map((l) => ({ l, p: d.products.find((x) => x.id === l.productId), daysLeft: differenceInCalendarDays(parseISO(l.expDate!), parseISO(today)) }))
    .filter(({ p }) => p && (!f.categoryId || p.categoryId === f.categoryId) && (!f.brandId || p.brandId === f.brandId))
    .filter(({ daysLeft }) => (!f.window ? true : f.window === "expired" ? daysLeft < 0 : daysLeft >= 0 && daysLeft <= EXPIRY_WINDOWS[f.window]))
    .map(({ l, p, daysLeft }): ExpiryRow => {
      const v = d.variations.find((x) => x.id === l.variationId);
      return {
        lotId: l.id, product: p!.name, variation: p!.type === "variable" ? (v?.name ?? "") : "", sku: v?.sku ?? "", locationName: names.location(d, l.locationId), lotNo: l.lotNo,
        expDate: l.expDate!, daysLeft, qty: l.qtyRemaining, value: roundMoney(l.qtyRemaining * l.unitCost), unit: d.units.find((u) => u.id === p!.unitId)?.shortName ?? "",
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return withTotals(rows, ["qty", "value"]);
}

// ── Stock adjustment summary ────────────────────────────────────────────

export type AdjustmentReport = { normal: number; abnormal: number; total: number; recovered: number; netLoss: number };
export type AdjustmentReportRow = { id: string; date: string; refNo: string; locationName: string; type: string; total: number; recovered: number; reason: string; addedBy: string };

export function adjustmentReport(d: DB, f: ReportFilter): ReportResult<AdjustmentReportRow> & { summary: AdjustmentReport } {
  const ts = d.transactions.filter((t) => t.type === "stock_adjustment" && inScope(t, f)).sort((a, b) => b.date.localeCompare(a.date));
  const rows = ts.map((t): AdjustmentReportRow => {
    const u = d.users.find((x) => x.id === t.createdBy);
    return { id: t.id, date: t.date, refNo: t.refNo, locationName: names.location(d, t.locationId), type: t.adjustmentType ?? "normal", total: t.totals.total, recovered: t.amountRecovered, reason: t.notes, addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "" };
  });
  const of = (type: string) => sumBy(rows.filter((r) => r.type === type), (r) => r.total);
  const total = sumBy(rows, (r) => r.total);
  const recovered = sumBy(rows, (r) => r.recovered);
  return { ...withTotals(rows, ["total", "recovered"]), summary: { normal: of("normal"), abnormal: of("abnormal"), total, recovered, netLoss: roundMoney(total - recovered) } };
}

export const stockReports = service("stockReports", {
  async stock(f: StockFilter = {}) { await delay(); return stockReport(getDB(), f); },
  async expiry(f: ExpiryFilter = {}) { await delay(); return stockExpiry(getDB(), f); },
  async adjustments(f: ReportFilter = {}) { await delay(); return adjustmentReport(getDB(), f); },

  /** Fixes a wrongly entered expiry date on one lot. */
  async editExpiry(lotId: string, expDate: string | null): Promise<void> {
    await delay();
    assertCan("product.update");
    commit((d) => {
      const lot = d.stockLots.find((l) => l.id === lotId);
      if (!lot) throw new NotFoundError("Lot");
      lot.expDate = expDate;
    });
  },

  /** Writes off what is left of one lot as an abnormal adjustment, so the stock and the books both move. */
  async removeExpired(lotId: string): Promise<{ refNo: string }> {
    await delay();
    assertCan("stock_adjustment.create");
    let refNo = "";
    commit((d) => {
      const lot = d.stockLots.find((l) => l.id === lotId);
      if (!lot) throw new NotFoundError("Lot");
      if (!(lot.qtyRemaining > 0)) throw new ValidationError({ qty: "nothing_left" });
      const p = d.products.find((x) => x.id === lot.productId);
      const qty = lot.qtyRemaining;
      lot.qtyRemaining = 0;
      const at = nowISO();
      refNo = takeRef(d, d.settings.prefixes.stockAdjustment, at);
      const subtotal = roundMoney(qty * lot.unitCost);
      d.transactions.push(transaction.parse({
        id: uid("t"), createdAt: at, createdBy: currentUser()?.user.id ?? null, type: "stock_adjustment", status: "final", locationId: lot.locationId, refNo, date: at,
        lines: [{ id: uid("l"), productId: lot.productId, variationId: lot.variationId, unitId: p?.unitId ?? "", qty, unitPrice: lot.unitCost, subtotal, unitCost: lot.unitCost, allocations: [{ lotId: lot.id, qty, unitCost: lot.unitCost }] }],
        totals: { itemsCount: qty, linesTotal: subtotal, discount: 0, orderTax: 0, shipping: 0, additional: 0, redeemed: 0, roundOff: 0, total: subtotal },
        paymentStatus: "paid", adjustmentType: "abnormal", amountRecovered: 0, notes: "Expired stock written off",
      }));
    });
    return { refNo };
  },
});
