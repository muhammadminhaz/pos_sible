"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/shared/Money";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useReport } from "@/lib/data/hooks/reports";
import { useSettings } from "@/lib/data/hooks/settings";
import { activityReports, type ExpenseReportRow, type PaymentLine, type RegisterReportRow, type RepRow, type TableRow } from "@/lib/data/services/reports/activity";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { BarChart } from "./Charts";
import { useContactGroupsLookup, useUserLookup } from "./lookups";
import { Panel, Stats } from "./parts";
import { ReportShell, useReportFilters } from "./ReportShell";
import { ReportTable, type Col } from "./ReportTable";
import { PAYMENT_METHODS } from "@/lib/data/schemas";

function PaymentReport({ kind }: { kind: "sell" | "purchase" }) {
  const t = useTranslations("reports");
  const root = useTranslations();
  const { data: settings } = useSettings();
  const labels = settings?.customLabels.payments ?? [];
  const sell = kind === "sell";
  const rf = useReportFilters(["contact", "method", "group"] as const);
  const { data: contacts } = useContacts({ type: sell ? "customer" : "supplier", pageSize: -1 });
  const groups = useContactGroupsLookup();
  const filter = { ...rf.filter, contactId: rf.url.contact, method: rf.url.method, customerGroupId: rf.url.group };
  const { data, isFetching } = useReport(`${kind}-payments`, filter, () => (sell ? activityReports.sellPayments(filter) : activityReports.purchasePayments(filter)));
  const method = (m: string) => methodLabel(m as never, root, labels);
  const cols: Col<PaymentLine>[] = [
    { key: "date", label: t("date"), kind: "datetime" }, { key: "paymentRef", label: t("paymentRef") }, { key: "refNo", label: t("invoiceRef") },
    { key: "contactName", label: sell ? t("customer") : t("supplier") }, { key: "locationName", label: t("location") },
    { key: "method", label: t("paymentMethod"), render: (r) => method(r.method), csv: (r) => method(r.method) }, { key: "accountName", label: t("account") },
    { key: "amount", label: t("amount"), kind: "money", total: true },
  ];
  return (
    <ReportShell
      title={t(sell ? "sellPaymentTitle" : "purchasePaymentTitle")} description={t(sell ? "sellPaymentDescription" : "purchasePaymentDescription")} rf={rf}
      extraDefs={[
        { key: "contact", label: sell ? t("customer") : t("supplier"), type: "select", options: (contacts?.rows ?? []).map((c) => ({ value: c.id, label: c.name })) },
        { key: "method", label: t("paymentMethod"), type: "select", options: PAYMENT_METHODS.map((m) => ({ value: m, label: method(m) })) },
        ...(sell ? [{ key: "group", label: t("customerGroup"), type: "select" as const, options: groups }] : []),
      ]}
    >
      {data && data.byMethod.length > 0 && (
        <Panel title={t("byMethod")}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.byMethod.map((m) => <li key={m.method} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>{method(m.method)} · {m.count}</span><Money value={m.amount} className="font-medium" /></li>)}
          </ul>
        </Panel>
      )}
      <ReportTable id={`${kind}-payments`} columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} getRowId={(r) => r.id} />
    </ReportShell>
  );
}
export const SellPaymentReport = () => <PaymentReport kind="sell" />;
export const PurchasePaymentReport = () => <PaymentReport kind="purchase" />;

export function ExpenseReport() {
  const t = useTranslations("reports");
  const f = useFormat();
  const rf = useReportFilters();
  const { data, isFetching } = useReport("expense", rf.filter, () => activityReports.expense(rf.filter));
  const top = (data?.rows ?? []).filter((r) => r.level === 0);
  const cols: Col<ExpenseReportRow>[] = [
    { key: "name", label: t("category"), render: (r) => <span className={r.level ? "pl-6 text-muted-foreground" : "font-medium"}>{r.name}</span>, csv: (r) => (r.level ? `  ${r.name}` : r.name) },
    { key: "count", label: t("expenseCount"), kind: "number", total: true }, { key: "total", label: t("total"), kind: "money", total: true },
  ];
  return (
    <ReportShell title={t("expenseTitle")} description={t("expenseDescription")} rf={rf}>
      {top.length > 0 && <Panel title={t("expenseByCategory")}><BarChart data={top.map((r) => ({ name: r.name, total: r.total }))} xKey="name" yKey="total" label={t("expenseByCategory")} format={(n) => f.money(n)} /></Panel>}
      <ReportTable id="expense" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} getRowId={(r) => r.id} />
    </ReportShell>
  );
}

export function RegisterReport() {
  const t = useTranslations("reports");
  const root = useTranslations();
  const { data: settings } = useSettings();
  const labels = settings?.customLabels.payments ?? [];
  const users = useUserLookup();
  const rf = useReportFilters(["user", "status"] as const);
  const filter = { ...rf.filter, userId: rf.url.user, status: rf.url.status as "open" | "close" | undefined };
  const { data, isFetching } = useReport("registers", filter, () => activityReports.registers(filter));
  const methods = PAYMENT_METHODS.filter((m) => (data?.rows ?? []).some((r) => (r.byMethod[m] ?? 0) !== 0));
  const cols: Col<RegisterReportRow>[] = [
    { key: "openedAt", label: t("openedAt"), kind: "datetime" }, { key: "closedAt", label: t("closedAt"), kind: "datetime" }, { key: "userName", label: t("user") }, { key: "locationName", label: t("location") },
    { key: "opening", label: t("openingCash"), kind: "money", total: true },
    ...methods.map((m): Col<RegisterReportRow> => ({ key: "byMethod", id: `method-${m}`, label: methodLabel(m, root, labels), render: (r) => <Money value={r.byMethod[m] ?? 0} muted />, csv: (r) => r.byMethod[m] ?? 0 })),
    { key: "totalSales", label: t("totalSales"), kind: "money", total: true }, { key: "refunds", label: t("refunds"), kind: "money", total: true }, { key: "expenses", label: t("expenses"), kind: "money", total: true },
    { key: "expectedCash", label: t("expectedCash"), kind: "money", total: true }, { key: "closingAmount", label: t("closingCash"), kind: "money" },
    { key: "difference", label: t("difference"), render: (r) => (r.difference == null ? "—" : <Money value={r.difference} />), csv: (r) => r.difference },
  ];
  return (
    <ReportShell
      title={t("registerTitle")} description={t("registerDescription")} rf={rf}
      extraDefs={[
        { key: "user", label: t("user"), type: "select", options: users },
        { key: "status", label: t("status"), type: "select", options: [{ value: "open", label: t("open") }, { value: "close", label: t("closed") }] },
      ]}
    >
      <ReportTable id="registers" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} getRowId={(r) => r.id} />
    </ReportShell>
  );
}

type RepTab = "summary" | "sales" | "added" | "expenses";
const REP_TABS: RepTab[] = ["summary", "sales", "added", "expenses"];

export function SalesRepReport() {
  const t = useTranslations("reports");
  const users = useUserLookup();
  const rf = useReportFilters(["user"] as const);
  const [tab, setTab] = useState<RepTab>("summary");
  const userId = rf.url.user;
  const filter = { ...rf.filter, userId };
  const summary = useReport("reps", filter, () => activityReports.reps(filter));
  const needsUser = tab !== "summary";
  const detail = useReport(`rep-${tab}`, filter, async () => {
    if (!userId) return null;
    return tab === "sales" ? activityReports.repSales(userId, rf.filter) : tab === "added" ? activityReports.salesAdded(userId, rf.filter) : activityReports.repExpenses(userId, rf.filter);
  }, needsUser);
  const repCols: Col<RepRow>[] = [
    { key: "name", label: t("representative") }, { key: "invoices", label: t("invoices"), kind: "number", total: true },
    { key: "sales", label: t("sales"), kind: "money", total: true }, { key: "sellReturn", label: t("sellReturn"), kind: "money", total: true }, { key: "netSales", label: t("net"), kind: "money", total: true },
    { key: "commissionPercent", label: t("commissionPercent"), kind: "percent" }, { key: "commission", label: t("commission"), kind: "money", total: true }, { key: "expenses", label: t("expenses"), kind: "money", total: true },
  ];
  const rows = (detail.data?.rows ?? []) as Record<string, string | number>[];
  const detailCols: Col<Record<string, string | number>>[] =
    tab === "expenses"
      ? [{ key: "date", label: t("date"), kind: "datetime" }, { key: "refNo", label: t("refNo") }, { key: "category", label: t("category") }, { key: "note", label: t("note") }, { key: "total", label: t("total"), kind: "money", total: true }]
      : [
          { key: "date", label: t("date"), kind: "datetime" }, { key: "refNo", label: t("refNo") }, { key: "customer", label: t("customer") }, { key: "total", label: t("total"), kind: "money", total: true }, { key: "paid", label: t("paid"), kind: "money", total: true },
          ...(tab === "sales" ? [{ key: "commission", label: t("commission"), kind: "money" as const, total: true }] : []),
        ];
  return (
    <ReportShell
      title={t("salesRepTitle")} description={t("salesRepDescription")} rf={rf}
      extraDefs={[{ key: "user", label: t("representative"), type: "select", options: users }]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as RepTab)}>
        <TabsList>{REP_TABS.map((k) => <TabsTrigger key={k} value={k} disabled={k !== "summary" && !userId}>{t(`repTab.${k}`)}</TabsTrigger>)}</TabsList>
      </Tabs>
      {tab !== "summary" && !userId && <p className="text-sm text-muted-foreground">{t("pickRep")}</p>}
      {tab === "summary" ? (
        <>
          {summary.data && <Stats items={[{ label: t("net"), value: summary.data.totals.netSales ?? 0 }, { label: t("commission"), value: summary.data.totals.commission ?? 0, tone: "success" }, { label: t("expenses"), value: summary.data.totals.expenses ?? 0, tone: "danger" }]} cols={3} />}
          <ReportTable id="reps" columns={repCols} rows={summary.data?.rows ?? []} totals={summary.data?.totals} loading={summary.isFetching} getRowId={(r) => r.userId} />
        </>
      ) : userId ? (
        <ReportTable id={`rep-${tab}`} columns={detailCols} rows={rows} totals={detail.data?.totals as Record<string, number> | undefined} loading={detail.isFetching} />
      ) : null}
    </ReportShell>
  );
}

export function TableReport() {
  const t = useTranslations("reports");
  const { data: settings } = useSettings();
  const rf = useReportFilters();
  const { data, isFetching } = useReport("tables", rf.filter, () => activityReports.table(rf.filter));
  const cols: Col<TableRow>[] = [{ key: "tableId", label: t("table") }, { key: "invoices", label: t("invoices"), kind: "number", total: true }, { key: "total", label: t("total"), kind: "money", total: true }];
  return (
    <ReportShell title={t("tableTitle")} description={t("tableDescription")} rf={rf}>
      {settings && !settings.modules.tables && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("tablesOff")}</p>}
      <ReportTable id="tables" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}
