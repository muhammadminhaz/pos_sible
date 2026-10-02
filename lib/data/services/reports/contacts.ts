import type { DB } from "@/lib/data/schemas";
import { getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay } from "../_util";
import { inScope, isFinalSale, isReceivedPurchase, sumBy, withTotals, type ReportFilter, type ReportResult } from "./_shared";

export type ContactReportFilter = ReportFilter & { type?: "customer" | "supplier"; customerGroupId?: string | null };
export type ContactReportRow = {
  id: string; name: string; type: string; mobile: string;
  totalSale: number; sellReturn: number; saleDue: number;
  totalPurchase: number; purchaseReturn: number; purchaseDue: number;
  openingBalance: number;
};

/** One row per contact. Returns come out of the totals they belong to, so each total is net of its returns. */
export function contactsReport(d: DB, f: ContactReportFilter): ReportResult<ContactReportRow> {
  const ts = d.transactions.filter((t) => t.contactId && inScope(t, f));
  const by = new Map<string, typeof ts>();
  for (const t of ts) by.set(t.contactId!, [...(by.get(t.contactId!) ?? []), t]);
  const rows = d.contacts
    .filter((c) => !c.isDefault || by.has(c.id))
    .filter((c) => !f.type || (f.type === "customer" ? c.type !== "supplier" : c.type !== "customer"))
    .filter((c) => f.customerGroupId === undefined || (c.customerGroupId ?? null) === f.customerGroupId)
    .map((c): ContactReportRow => {
      const mine = by.get(c.id) ?? [];
      const sales = mine.filter(isFinalSale);
      const purchases = mine.filter(isReceivedPurchase);
      const due = (xs: typeof mine) => sumBy(xs, (t) => paymentSummary(t.totals.total, t.payments).due);
      return {
        id: c.id, name: c.businessName ? `${c.businessName} — ${c.name}` : c.name, type: c.type, mobile: c.mobile,
        totalSale: sumBy(sales, (t) => t.totals.total), sellReturn: sumBy(mine.filter((t) => t.type === "sell_return"), (t) => t.totals.total), saleDue: due(sales),
        totalPurchase: sumBy(purchases, (t) => t.totals.total), purchaseReturn: sumBy(mine.filter((t) => t.type === "purchase_return"), (t) => t.totals.total), purchaseDue: due(purchases),
        openingBalance: c.openingBalance,
      };
    })
    .filter((r) => !(f.from || f.to) || r.totalSale || r.sellReturn || r.totalPurchase || r.purchaseReturn)
    .sort((a, b) => a.name.localeCompare(b.name));
  return withTotals(rows, ["totalSale", "sellReturn", "saleDue", "totalPurchase", "purchaseReturn", "purchaseDue", "openingBalance"]);
}

export type GroupReportRow = { id: string; name: string; customers: number; sales: number; sellReturn: number; net: number };

export function customerGroupsReport(d: DB, f: ReportFilter): ReportResult<GroupReportRow> {
  const group = (contactId: string | null) => d.contacts.find((c) => c.id === contactId)?.customerGroupId ?? "";
  const ts = d.transactions.filter((t) => inScope(t, f) && (isFinalSale(t) || t.type === "sell_return"));
  const ids = [...d.customerGroups.map((g) => g.id), ""];
  const rows = ids.map((id): GroupReportRow => {
    const mine = ts.filter((t) => group(t.contactId) === id);
    const sales = sumBy(mine.filter(isFinalSale), (t) => t.totals.total);
    const sellReturn = sumBy(mine.filter((t) => t.type === "sell_return"), (t) => t.totals.total);
    return {
      id, name: d.customerGroups.find((g) => g.id === id)?.name ?? "", sales, sellReturn, net: roundMoney(sales - sellReturn),
      customers: d.contacts.filter((c) => c.type !== "supplier" && (c.customerGroupId ?? "") === id && !c.isDefault).length,
    };
  }).filter((r) => r.id !== "" || r.sales || r.sellReturn);
  return withTotals(rows, ["customers", "sales", "sellReturn", "net"]);
}

export const contactReports = {
  async contacts(f: ContactReportFilter = {}) { await delay(); return contactsReport(getDB(), f); },
  async customerGroups(f: ReportFilter = {}) { await delay(); return customerGroupsReport(getDB(), f); },
};
