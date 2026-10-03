import { differenceInCalendarDays, parseISO } from "date-fns";
import type { DB, Notification, Transaction } from "@/lib/data/schemas";
import { roundMoney } from "./money";
import { effectivePaymentStatus, paymentSummary } from "./payments";

/** Alerts a shop wants to hear about without having to open a report. */
export const ALERT_TYPES = [
  "overdueSales", "supplierOverdue", "outOfStock", "lowStock", "expired", "expiringSoon",
  "registerOpen", "creditLimit", "suspendedStale", "transferStuck", "undelivered",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export type Alert = {
  /** Stable identity: the same condition always produces the same key, so it is one notification, not a stream. */
  key: string;
  type: AlertType;
  kind: Notification["kind"];
  params: Record<string, string | number>;
  href: string;
  locationId: string | null;
  permission: string;
  signal: number;
};

/** Days a transfer, shipment or held sale may sit before it is worth a nudge. */
export const STALE_DAYS = 3;

const day = (iso: string) => iso.slice(0, 10);
const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(day(to)), parseISO(day(from)));
const KIND_RANK: Record<Notification["kind"], number> = { success: 0, info: 1, warning: 2, danger: 3 };

/** `a, b and 3 more`-style hint is built in the message; here we only pick the first name worth showing. */
const first = (names: string[]) => names[0] ?? "";

export function computeAlerts(d: DB, today: string): Alert[] {
  const out: Alert[] = [];
  const loc = (id: string) => d.locations.find((l) => l.id === id)?.name ?? "";
  const unit = (productId: string) => d.units.find((u) => u.id === d.products.find((p) => p.id === productId)?.unitId)?.shortName ?? "";
  const contactName = (id: string | null) => d.contacts.find((c) => c.id === id)?.name ?? "";
  const money = (n: number) => roundMoney(n);

  const finalSales = d.transactions.filter((t) => t.type === "sell" && t.status === "final");
  const dueOf = (t: Transaction) => paymentSummary(t.totals.total, t.payments).due;
  const byLocation = <T extends { locationId: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(x.locationId, [...(m.get(x.locationId) ?? []), x]);
    return m;
  };

  // Money owed to the shop and by the shop, past the agreed pay term.
  for (const [locationId, rows] of byLocation(finalSales.filter((t) => dueOf(t) > 0 && effectivePaymentStatus(t, today) === "overdue"))) {
    out.push({
      key: `overdueSales:${locationId}`, type: "overdueSales", kind: "danger", locationId, permission: "sell.view", signal: rows.length,
      href: `/sales?payment=overdue&location=${locationId}`,
      params: { count: rows.length, amount: money(rows.reduce((s, t) => s + dueOf(t), 0)), location: loc(locationId) },
    });
  }
  const purchases = d.transactions.filter((t) => t.type === "purchase" && t.status === "received");
  for (const [locationId, rows] of byLocation(purchases.filter((t) => dueOf(t) > 0 && effectivePaymentStatus(t, today) === "overdue"))) {
    out.push({
      key: `supplierOverdue:${locationId}`, type: "supplierOverdue", kind: "warning", locationId, permission: "purchase.view", signal: rows.length,
      href: `/purchases?payment=overdue&location=${locationId}`,
      params: { count: rows.length, amount: money(rows.reduce((s, t) => s + dueOf(t), 0)), location: loc(locationId) },
    });
  }

  // Stock that is gone, nearly gone, or past its date.
  const held = new Map<string, number>();
  for (const l of d.stockLots) held.set(`${l.variationId}|${l.locationId}`, roundMoney((held.get(`${l.variationId}|${l.locationId}`) ?? 0) + l.qtyRemaining, 4));
  for (const l of d.locations) {
    const rows: { name: string; stock: number }[] = [];
    for (const v of d.variations) {
      const p = d.products.find((x) => x.id === v.productId);
      if (!p || !p.manageStock || p.alertQty == null || !p.locationIds.includes(l.id)) continue;
      const stock = held.get(`${v.id}|${l.id}`) ?? 0;
      if (stock <= p.alertQty) rows.push({ name: p.type === "variable" ? `${p.name} (${v.name})` : p.name, stock });
    }
    rows.sort((a, b) => a.stock - b.stock);
    const gone = rows.filter((r) => r.stock <= 0);
    const low = rows.filter((r) => r.stock > 0);
    const href = `/reports/stock?location=${l.id}`;
    if (gone.length) out.push({ key: `outOfStock:${l.id}`, type: "outOfStock", kind: "danger", locationId: l.id, permission: "report.stock", signal: gone.length, href, params: { count: gone.length, example: first(gone.map((r) => r.name)), location: l.name } });
    if (low.length) out.push({ key: `lowStock:${l.id}`, type: "lowStock", kind: "warning", locationId: l.id, permission: "report.stock", signal: low.length, href, params: { count: low.length, example: first(low.map((r) => r.name)), location: l.name } });
  }
  const windowDays = d.settings.dashboard.stockExpiryAlertDays;
  const lots = d.stockLots
    .filter((l) => l.expDate && l.qtyRemaining > 0)
    .map((l) => ({ l, left: daysBetween(today, l.expDate!), name: d.products.find((p) => p.id === l.productId)?.name ?? "", u: unit(l.productId) }))
    .sort((a, b) => a.left - b.left);
  for (const [locationId, rows] of byLocation(lots.map((x) => ({ ...x, locationId: x.l.locationId })))) {
    const expired = rows.filter((r) => r.left < 0);
    const soon = rows.filter((r) => r.left >= 0 && r.left <= windowDays);
    const href = `/reports/stock-expiry?location=${locationId}`;
    if (expired.length) out.push({ key: `expired:${locationId}`, type: "expired", kind: "danger", locationId, permission: "report.stock", signal: expired.length, href, params: { count: expired.length, example: first(expired.map((r) => r.name)), location: loc(locationId) } });
    if (soon.length) out.push({ key: `expiringSoon:${locationId}`, type: "expiringSoon", kind: "warning", locationId, permission: "report.stock", signal: soon.length, href, params: { count: soon.length, days: windowDays, example: first(soon.map((r) => r.name)), location: loc(locationId) } });
  }

  // Cash drawers left open from an earlier day.
  for (const r of d.cashRegisters.filter((x) => x.status === "open" && day(x.openedAt) < today)) {
    const u = d.users.find((x) => x.id === r.userId);
    out.push({
      key: `registerOpen:${r.id}`, type: "registerOpen", kind: "warning", locationId: r.locationId, permission: "cash_register.close", signal: Math.max(1, daysBetween(r.openedAt, today)),
      href: "/pos", params: { location: loc(r.locationId), user: u ? `${u.firstName} ${u.lastName}`.trim() : "", since: r.openedAt },
    });
  }

  // Customers whose unpaid invoices exceed the credit they were given.
  const owed = new Map<string, number>();
  for (const t of finalSales) if (t.contactId) owed.set(t.contactId, roundMoney((owed.get(t.contactId) ?? 0) + dueOf(t)));
  const over = d.contacts
    .filter((c) => c.active && c.creditLimit != null && c.creditLimit > 0 && (owed.get(c.id) ?? 0) > c.creditLimit)
    .map((c) => ({ c, amount: owed.get(c.id) ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
  if (over.length) {
    out.push({
      key: "creditLimit", type: "creditLimit", kind: "warning", locationId: null, permission: "contacts.customer", signal: over.length, href: "/contacts/customers",
      params: { count: over.length, name: over[0].c.name, amount: over[0].amount, limit: over[0].c.creditLimit! },
    });
  }

  // Things started and then forgotten.
  const held2 = d.transactions.filter((t) => t.type === "sell" && t.status === "suspended" && day(t.date) < today);
  for (const [locationId, rows] of byLocation(held2)) {
    out.push({ key: `suspendedStale:${locationId}`, type: "suspendedStale", kind: "info", locationId, permission: "pos.access", signal: rows.length, href: "/pos", params: { count: rows.length, location: loc(locationId) } });
  }
  for (const t of d.transactions.filter((x) => x.type === "stock_transfer" && (x.status === "pending" || x.status === "in_transit") && daysBetween(x.date, today) >= STALE_DAYS)) {
    out.push({
      key: `transferStuck:${t.id}`, type: "transferStuck", kind: "warning", locationId: t.transferLocationId ?? t.locationId, permission: "stock_transfer.view", signal: daysBetween(t.date, today),
      href: `/stock/transfers/${t.id}`, params: { ref: t.refNo, days: daysBetween(t.date, today), from: loc(t.locationId), to: loc(t.transferLocationId ?? "") },
    });
  }
  const undelivered = finalSales.filter((t) => ["ordered", "packed", "shipped"].includes(t.shipping.status ?? "") && daysBetween(t.date, today) >= STALE_DAYS);
  for (const [locationId, rows] of byLocation(undelivered)) {
    out.push({
      key: `undelivered:${locationId}`, type: "undelivered", kind: "warning", locationId, permission: "sell.view", signal: rows.length,
      href: "/sales/shipments", params: { count: rows.length, days: STALE_DAYS, location: loc(locationId), customer: contactName(rows[0].contactId) },
    });
  }
  return out;
}

/** Keyless notifications that older demo data was seeded with; generated alerts now say the same thing, accurately. */
const isLegacyAlert = (n: Notification) =>
  !n.key && n.createdBy === null && /^(Payment overdue|Low stock|Stock expiring)/.test(n.title);

/**
 * Brings the stored notifications in line with the alerts that are true right now:
 * new conditions appear, resolved ones disappear, and an alert that got worse becomes unread again.
 * Returns `null` when nothing needs to change so callers can skip a write.
 */
export function reconcile(existing: Notification[], alerts: Alert[], now: string, newId: () => string): Notification[] | null {
  const live = new Map(existing.filter((n) => n.key).map((n) => [n.key!, n]));
  const next: Notification[] = existing.filter((n) => !n.key && !isLegacyAlert(n));

  for (const a of alerts) {
    const old = live.get(a.key);
    const fields = { kind: a.kind, type: a.type, params: a.params, href: a.href, locationId: a.locationId, permission: a.permission, signal: a.signal };
    if (!old) {
      next.push({ id: newId(), createdAt: now, createdBy: null, title: "", body: "", readAt: null, readBy: {}, key: a.key, ...fields });
      continue;
    }
    const worse = a.signal > (old.signal ?? 0) || KIND_RANK[a.kind] > KIND_RANK[old.kind];
    next.push({ ...old, ...fields, ...(worse ? { createdAt: now, readAt: null, readBy: {} } : {}) });
  }

  const same = (a: Notification[], b: Notification[]) => {
    const sig = (xs: Notification[]) => JSON.stringify([...xs].sort((p, q) => p.id.localeCompare(q.id)));
    return sig(a) === sig(b);
  };
  return same(existing, next) ? null : next;
}
