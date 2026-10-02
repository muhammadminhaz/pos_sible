"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/lib/data/hooks/reports";
import { moneyReports, type ProfitDimension, type ProfitRow } from "@/lib/data/services/reports/money";
import { Lines, Panel, Stats } from "./parts";
import { ReportShell, useReportFilters } from "./ReportShell";
import { ReportTable, type Col } from "./ReportTable";

const DIMS: ProfitDimension[] = ["product", "category", "brand", "location", "invoice", "date", "customer"];

export function ProfitLoss() {
  const t = useTranslations("reports");
  const rf = useReportFilters();
  const [dim, setDim] = useState<ProfitDimension>("product");
  const summary = useReport("profit", rf.filter, () => moneyReports.profitLoss(rf.filter));
  const rows = useReport(`profit-${dim}`, rf.filter, () => moneyReports.profitBreakdown(dim, rf.filter));
  const s = summary.data;
  const cols: Col<ProfitRow>[] = [
    { key: "label", label: t(`dim.${dim}`) },
    { key: "sales", label: t("sales"), kind: "money", total: true },
    { key: "cost", label: t("cost"), kind: "money", total: true },
    { key: "profit", label: t("profit"), kind: "money", total: true },
    { key: "margin", label: t("margin"), kind: "percent" },
  ];
  return (
    <ReportShell title={t("profitLossTitle")} description={t("profitLossDescription")} rf={rf}>
      {s && (
        <>
          <Stats items={[
            { label: t("grossProfit"), value: s.grossProfit, tone: "success" }, { label: t("expenses"), value: s.expenses, tone: "danger" },
            { label: t("netProfit"), value: s.netProfit, tone: s.netProfit >= 0 ? "success" : "danger" }, { label: t("closingStock"), value: s.closingStock, tone: "info" },
          ]} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("stockAndPurchases")}>
              <Lines rows={[
                { label: t("openingStock"), value: s.openingStock }, { label: t("totalPurchase"), value: s.totalPurchase }, { label: t("purchaseReturn"), value: -s.purchaseReturn },
                { label: t("stockAdjustment"), value: -s.stockAdjustment }, { label: t("closingStock"), value: s.closingStock, strong: true },
              ]} />
            </Panel>
            <Panel title={t("salesAndProfit")}>
              <Lines rows={[
                { label: t("sales"), value: s.sales }, { label: t("sellReturn"), value: -s.sellReturn }, { label: t("cogs"), value: -s.cogs },
                { label: t("grossProfit"), value: s.grossProfit, strong: true }, { label: t("expenses"), value: -s.expenses }, { label: t("netProfit"), value: s.netProfit, strong: true },
              ]} />
            </Panel>
          </div>
        </>
      )}
      <Tabs value={dim} onValueChange={(v) => setDim(v as ProfitDimension)}>
        <TabsList className="flex-wrap">{DIMS.map((d) => <TabsTrigger key={d} value={d}>{t(`dim.${d}`)}</TabsTrigger>)}</TabsList>
      </Tabs>
      <ReportTable id={`profit-${dim}`} columns={cols} rows={rows.data?.rows ?? []} totals={rows.data?.totals} loading={rows.isFetching} />
    </ReportShell>
  );
}
