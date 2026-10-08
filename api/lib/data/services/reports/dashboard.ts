import { service } from "@/lib/data/api/facade";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { DB } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay } from "../_util";
import { dayOf, inScope, isFinalSale, isReceivedPurchase, names, type ReportFilter } from "./_shared";
import { firstDate } from "./analytics";
import { stockExpiry, type ExpiryRow } from "./stock";
import { trendingProducts, type TrendingRow } from "./products";

export type DuePayment = { id: string; date: string; refNo: string; contactName: string; total: number; due: number };
export type StockAlert = { variationId: string; product: string; variation: string; sku: string; locationName: string; stock: number; alertQty: number; unit: string };
export type DashboardExtras = {
  salesByDay: { date: string; sales: number }[];
  topProducts: TrendingRow[];
  stockAlerts: StockAlert[];
  salesDue: DuePayment[];
  purchasesDue: DuePayment[];
  expiryAlerts: ExpiryRow[];
  /** Totals across every alerting lot, not only the ones listed. */
  expiryCount: { expired: number; soon: number };
};

const LIST = 8;
const EXPIRY_LIST = 6;

/** Up to half the slots each for expired and still-sellable lots, so the soon-to-expire ones (the ones you can act on) always show. */
function splitExpiry(rows: ExpiryRow[]): ExpiryRow[] {
  const expired = rows.filter((r) => r.daysLeft < 0);
  const soon = rows.filter((r) => r.daysLeft >= 0);
  const takeSoon = Math.min(soon.length, Math.max(EXPIRY_LIST / 2, EXPIRY_LIST - expired.length));
  return [...expired.slice(0, EXPIRY_LIST - takeSoon), ...soon.slice(0, takeSoon)];
}

/** Net of returns would hide the day's takings, so the chart shows invoiced sales. */
export function salesByDay(d: DB, days: number, today: string, locationId?: string | null) {
  const start = addDays(parseISO(today), -(days - 1));
  const out = Array.from({ length: days }, (_, i) => ({ date: format(addDays(start, i), "yyyy-MM-dd"), sales: 0 }));
  const idx = new Map(out.map((r, i) => [r.date, i]));
  for (const t of d.transactions) {
    if (!isFinalSale(t) || (locationId && t.locationId !== locationId)) continue;
    const i = idx.get(dayOf(t.date));
    if (i !== undefined) out[i].sales = roundMoney(out[i].sales + t.totals.total);
  }
  return out;
}

/** Variations at or below their alert quantity, per location the stock sits in. */
export function stockAlerts(d: DB, locationId?: string | null): StockAlert[] {
  const held = new Map<string, number>();
  for (const l of d.stockLots) {
    if (locationId && l.locationId !== locationId) continue;
    const k = `${l.variationId}|${l.locationId}`;
    held.set(k, roundMoney((held.get(k) ?? 0) + l.qtyRemaining, 4));
  }
  const out: StockAlert[] = [];
  for (const v of d.variations) {
    const p = d.products.find((x) => x.id === v.productId);
    if (!p || !p.manageStock || p.alertQty == null) continue;
    for (const loc of d.locations.filter((l) => !locationId || l.id === locationId).filter((l) => p.locationIds.includes(l.id))) {
      const stock = held.get(`${v.id}|${loc.id}`) ?? 0;
      if (stock <= p.alertQty) out.push({ variationId: v.id, product: p.name, variation: p.type === "variable" ? v.name : "", sku: v.sku, locationName: loc.name, stock, alertQty: p.alertQty, unit: d.units.find((u) => u.id === p.unitId)?.shortName ?? "" });
    }
  }
  return out.sort((a, b) => a.stock - b.stock);
}

function dues(d: DB, pick: (t: DB["transactions"][number]) => boolean, f: ReportFilter): DuePayment[] {
  return d.transactions
    .filter((t) => pick(t) && inScope(t, f))
    .map((t) => ({ id: t.id, date: t.date, refNo: t.refNo, contactName: names.contact(d, t.contactId), total: t.totals.total, due: paymentSummary(t.totals.total, t.payments).due }))
    .filter((r) => r.due > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function dashboardExtras(d: DB, f: ReportFilter & { today?: string }): DashboardExtras {
  const today = f.today ?? todayISO(d.settings.business.timeZone);
  const alertDays = d.settings.dashboard.stockExpiryAlertDays;
  const expiring = stockExpiry(d, { locationId: f.locationId, today }).rows.filter((r) => r.daysLeft <= alertDays);
  return {
    // Follows the selected range (never past today); without one, the last 30 days.
    salesByDay: f.from && f.to
      ? (() => {
          const end = f.to < today ? f.to : today;
          const days = Math.min(400, Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(f.from)) + 1));
          return salesByDay(d, days, end, f.locationId);
        })()
      : salesByDay(d, 30, today, f.locationId),
    topProducts: trendingProducts(d, f, 5).rows,
    stockAlerts: stockAlerts(d, f.locationId).slice(0, LIST),
    salesDue: dues(d, isFinalSale, { locationId: f.locationId }).slice(0, LIST),
    purchasesDue: dues(d, isReceivedPurchase, { locationId: f.locationId }).slice(0, LIST),
    expiryAlerts: splitExpiry(expiring),
    expiryCount: { expired: expiring.filter((r) => r.daysLeft < 0).length, soon: expiring.filter((r) => r.daysLeft >= 0).length },
  };
}

export const dashboardReports = service("dashboardReports", {
  async extras(f: ReportFilter & { today?: string } = {}) { await delay(); return dashboardExtras(getDB(), f); },
  async firstDate() { await delay(); return firstDate(getDB()); },
});
