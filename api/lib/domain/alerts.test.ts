import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO } from "@/lib/data/seed/mk";
import { computeAlerts, reconcile, type Alert } from "./alerts";
import type { DB } from "@/lib/data/schemas";

const TODAY = "2026-09-28";
const fresh = (): DB => structuredClone(createSeed({ seed: 42, today: TODAY }));
const find = (a: Alert[], type: string, loc?: string) => a.find((x) => x.type === type && (loc === undefined || x.locationId === loc));

/** A database with every alert condition cleared, so each test creates exactly the one it is about. */
function quiet(): DB {
  const d = fresh();
  for (const t of d.transactions) {
    if (t.type === "sell" || t.type === "purchase") t.payments = [{ id: `p_${t.id}`, amount: t.totals.total, method: "cash", paidAt: t.date, isReturn: false, details: {}, note: "", accountId: null } as never];
    if (t.type === "stock_transfer") t.status = "completed";
    if (t.shipping) t.shipping.status = "delivered";
    if (t.status === "suspended") t.status = "final";
  }
  for (const l of d.stockLots) l.expDate = null;
  for (const p of d.products) p.alertQty = null;
  for (const r of d.cashRegisters) r.status = "close";
  for (const c of d.contacts) c.creditLimit = null;
  return d;
}

describe("computeAlerts", () => {
  it("raises nothing when every condition is clear", () => {
    expect(computeAlerts(quiet(), TODAY)).toEqual([]);
  });

  it("flags unpaid invoices past their pay term, per location, with the amount owed", () => {
    const d = quiet();
    const sale = d.transactions.find((t) => t.type === "sell" && t.status === "final" && t.totals.total > 0)!;
    sale.payments = [];
    sale.date = "2026-06-01T10:00:00";
    sale.payTerm = { number: 7, type: "days" };
    const a = find(computeAlerts(d, TODAY), "overdueSales", sale.locationId)!;
    expect(a.kind).toBe("danger");
    expect(a.params.count).toBe(1);
    expect(a.params.amount).toBe(sale.totals.total);
    expect(a.href).toContain(`location=${sale.locationId}`);
  });

  it("does not flag an unpaid invoice that is still inside its pay term", () => {
    const d = quiet();
    const sale = d.transactions.find((t) => t.type === "sell" && t.status === "final" && t.totals.total > 0)!;
    sale.payments = [];
    sale.date = "2026-09-27T10:00:00";
    sale.payTerm = { number: 30, type: "days" };
    expect(find(computeAlerts(d, TODAY), "overdueSales")).toBeUndefined();
  });

  it("separates out-of-stock from low-stock and names the first product", () => {
    const d = quiet();
    const v = d.variations.find((x) => {
      const p = d.products.find((q) => q.id === x.productId)!;
      return p.manageStock && p.locationIds.includes(LOC_RANGO);
    })!;
    const p = d.products.find((x) => x.id === v.productId)!;
    p.alertQty = 1_000_000;
    const all = computeAlerts(d, TODAY);
    const low = find(all, "lowStock", LOC_RANGO) ?? find(all, "outOfStock", LOC_RANGO);
    expect(low).toBeDefined();
    for (const l of d.stockLots) if (l.variationId === v.id && l.locationId === LOC_RANGO) l.qtyRemaining = 0;
    const gone = find(computeAlerts(d, TODAY), "outOfStock", LOC_RANGO)!;
    expect(gone.kind).toBe("danger");
    expect(gone.params.count).toBeGreaterThanOrEqual(1);
  });

  it("flags expired and soon-to-expire lots separately", () => {
    const d = quiet();
    const [a, b] = d.stockLots.filter((l) => l.locationId === LOC_RANGO && l.qtyRemaining > 0);
    a.expDate = "2026-09-20";
    b.expDate = "2026-10-05";
    const out = computeAlerts(d, TODAY);
    expect(find(out, "expired", LOC_RANGO)?.params.count).toBe(1);
    expect(find(out, "expiringSoon", LOC_RANGO)?.params.count).toBe(1);
  });

  it("flags a register left open from an earlier day but not one opened today", () => {
    const d = quiet();
    const r = d.cashRegisters[0];
    r.status = "open";
    r.openedAt = "2026-09-26T09:00:00";
    expect(find(computeAlerts(d, TODAY), "registerOpen", r.locationId)).toBeDefined();
    r.openedAt = `${TODAY}T09:00:00`;
    expect(find(computeAlerts(d, TODAY), "registerOpen")).toBeUndefined();
  });

  it("flags customers whose unpaid invoices exceed their credit limit", () => {
    const d = quiet();
    const sale = d.transactions.find((t) => t.type === "sell" && t.status === "final" && t.contactId && t.totals.total > 10)!;
    sale.payments = [];
    d.contacts.find((c) => c.id === sale.contactId)!.creditLimit = 1;
    const a = find(computeAlerts(d, TODAY), "creditLimit")!;
    expect(a.locationId).toBeNull();
    expect(a.params.amount).toBeGreaterThan(1);
  });

  it("flags transfers and shipments that have been waiting too long", () => {
    const d = quiet();
    const t = d.transactions.find((x) => x.type === "stock_transfer")!;
    t.status = "in_transit";
    t.date = "2026-09-20T10:00:00";
    expect(find(computeAlerts(d, TODAY), "transferStuck")?.params.ref).toBe(t.refNo);
    const s = d.transactions.find((x) => x.type === "sell" && x.status === "final")!;
    s.shipping.status = "shipped";
    s.date = "2026-09-20T10:00:00";
    expect(find(computeAlerts(d, TODAY), "undelivered", s.locationId)?.params.count).toBe(1);
  });
});

describe("reconcile", () => {
  const id = (() => {
    let n = 0;
    return () => `n_${n++}`;
  })();
  const alert = (over: Partial<Alert> = {}): Alert => ({
    key: "lowStock:loc_rango", type: "lowStock", kind: "warning", params: { count: 2 }, href: "/x", locationId: LOC_RANGO, permission: "report.stock", signal: 2, ...over,
  });

  it("adds a notification for a new condition and is a no-op when nothing changed", () => {
    const first = reconcile([], [alert()], "2026-09-28T09:00:00", id)!;
    expect(first).toHaveLength(1);
    expect(first[0].key).toBe("lowStock:loc_rango");
    expect(reconcile(first, [alert()], "2026-09-28T09:05:00", id)).toBeNull();
  });

  it("deletes notifications older than 30 days, and raises a fresh one if the problem is still there", () => {
    const first = reconcile([], [alert()], "2026-08-01T09:00:00", id)!;
    const manual = { ...first[0], id: "m1", key: null, createdAt: "2026-08-01T09:00:00" };
    expect(reconcile([manual], [], "2026-08-20T09:00:00", id)).toBeNull(); // 19 days old: kept, nothing to change
    expect(reconcile([manual], [], "2026-09-05T09:00:00", id)).toEqual([]); // 35 days old: gone
    const again = reconcile(first, [alert()], "2026-09-05T09:00:00", id)!;
    expect(again).toHaveLength(1);
    expect(again[0].createdAt).toBe("2026-09-05T09:00:00");
    expect(again[0].readBy).toEqual({});
  });

  it("reminds about a problem that was read and left alone for 3 days, but not before and not if unread", () => {
    const first = reconcile([], [alert()], "2026-09-20T09:00:00", id)!;
    expect(reconcile(first, [alert()], "2026-09-25T09:00:00", id)).toBeNull(); // unread: no repeat
    first[0].readBy = { user_admin: "2026-09-20T10:00:00" };
    expect(reconcile(first, [alert()], "2026-09-22T09:00:00", id)).toBeNull(); // 2 days: too soon
    const reminded = reconcile(first, [alert()], "2026-09-23T10:00:00", id)!;
    expect(reminded[0].readBy).toEqual({});
    expect(reminded[0].createdAt).toBe("2026-09-23T10:00:00");
  });

  it("removes a notification once its condition is resolved", () => {
    const first = reconcile([], [alert()], "2026-09-28T09:00:00", id)!;
    expect(reconcile(first, [], "2026-09-28T10:00:00", id)).toEqual([]);
  });

  it("keeps who has read it while the problem stays the same size, and resets it when it gets worse", () => {
    const first = reconcile([], [alert()], "2026-09-28T09:00:00", id)!;
    first[0].readBy = { user_admin: "2026-09-28T09:30:00" };
    const same = reconcile(first, [alert({ params: { count: 2, example: "Pen" } })], "2026-09-28T10:00:00", id)!;
    expect(same[0].readBy).toEqual({ user_admin: "2026-09-28T09:30:00" });
    const fewer = reconcile(first, [alert({ signal: 1, params: { count: 1 } })], "2026-09-28T10:00:00", id);
    expect(fewer![0].readBy).toEqual({ user_admin: "2026-09-28T09:30:00" });
    const worse = reconcile(first, [alert({ signal: 5, params: { count: 5 } })], "2026-09-28T11:00:00", id)!;
    expect(worse[0].readBy).toEqual({});
    expect(worse[0].createdAt).toBe("2026-09-28T11:00:00");
  });

  it("treats a warning that becomes a danger as worse", () => {
    const first = reconcile([], [alert()], "2026-09-28T09:00:00", id)!;
    first[0].readBy = { user_admin: "2026-09-28T09:30:00" };
    expect(reconcile(first, [alert({ kind: "danger" })], "2026-09-28T10:00:00", id)![0].readBy).toEqual({});
  });

  it("leaves hand-written notifications alone and drops the old hard-coded demo alerts", () => {
    const d = fresh();
    const welcome = d.notifications.find((n) => n.title.startsWith("Welcome"))!;
    const legacy = { ...welcome, id: "n_old", title: "Payment overdue: SC-00003", key: null };
    const out = reconcile([welcome, legacy], [], "2026-09-28T09:00:00", id)!;
    expect(out.map((n) => n.id)).toEqual([welcome.id]);
  });

  it("keys differ per location so each shop gets its own alert", () => {
    const out = reconcile([], [alert(), alert({ key: "lowStock:loc_nipun", locationId: LOC_NIPUN })], "2026-09-28T09:00:00", id)!;
    expect(out).toHaveLength(2);
  });
});
