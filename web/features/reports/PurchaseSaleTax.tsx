"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/lib/data/hooks/reports";
import { moneyReports, type Flow, type TaxKind, type TaxRow } from "@/lib/data/services/reports/money";
import { Lines, Panel, Stats } from "./parts";
import { ReportShell, useReportFilters } from "./ReportShell";
import { ReportTable, type Col } from "./ReportTable";

export function PurchaseSale() {
  const t = useTranslations("reports");
  const rf = useReportFilters();
  const { data: p } = useReport("purchase-sale", rf.filter, () => moneyReports.purchaseSale(rf.filter));
  const block = (title: string, a: Flow, b: Flow, bLabel: string) => (
    <Panel title={title}>
      <Lines rows={[
        { label: t("invoices"), value: a.count, plain: true }, { label: t("total"), value: a.total }, { label: t("tax"), value: a.tax }, { label: t("due"), value: a.due },
        { label: bLabel, value: -b.total }, { label: t("net"), value: a.total - b.total, strong: true },
      ]} />
    </Panel>
  );
  return (
    <ReportShell title={t("purchaseSaleTitle")} description={t("purchaseSaleDescription")} rf={rf}>
      {p && (
        <>
          <Stats cols={3} items={[
            { label: t("overall"), value: p.saleMinusPurchase, tone: p.saleMinusPurchase >= 0 ? "success" : "danger" },
            { label: t("saleMinusPurchase"), value: p.sales.total - p.purchases.total }, { label: t("dueDifference"), value: p.dueDifference, tone: "warning" },
          ]} />
          <div className="grid gap-4 lg:grid-cols-2">
            {block(t("purchases"), p.purchases, p.purchaseReturns, t("purchaseReturn"))}
            {block(t("sales"), p.sales, p.sellReturns, t("sellReturn"))}
          </div>
        </>
      )}
    </ReportShell>
  );
}

const KINDS: TaxKind[] = ["output", "input", "expense"];

export function TaxReport() {
  const t = useTranslations("reports");
  const rf = useReportFilters();
  const [kind, setKind] = useState<TaxKind>("output");
  const { data, isFetching } = useReport(`tax-${kind}`, rf.filter, () => moneyReports.tax(kind, rf.filter));
  const cols: Col<TaxRow>[] = [
    { key: "date", label: t("date"), kind: "date" }, { key: "refNo", label: t("refNo") }, { key: "contactName", label: t("contact") }, { key: "locationName", label: t("location") },
    { key: "total", label: t("total"), kind: "money", total: true }, { key: "tax", label: t("tax"), kind: "money", total: true },
  ];
  const s = data?.summary;
  return (
    <ReportShell title={t("taxTitle")} description={t("taxDescription")} rf={rf}>
      {s && <Stats items={[{ label: t("outputTax"), value: s.output }, { label: t("inputTax"), value: s.input }, { label: t("expenseTax"), value: s.expense }, { label: t("taxPayable"), value: s.payable, tone: s.payable > 0 ? "warning" : "success" }]} />}
      <Tabs value={kind} onValueChange={(v) => setKind(v as TaxKind)}>
        <TabsList>{KINDS.map((k) => <TabsTrigger key={k} value={k}>{t(`${k}Tax`)}</TabsTrigger>)}</TabsList>
      </Tabs>
      <ReportTable id={`tax-${kind}`} columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}
