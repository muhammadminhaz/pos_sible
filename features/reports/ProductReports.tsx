"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/lib/data/hooks/reports";
import { useContacts } from "@/lib/data/hooks/contacts";
import { productReports, type GroupBy, type GroupedRow, type ItemRow, type LineRow, type TrendingRow } from "@/lib/data/services/reports/products";
import { BarChart } from "./Charts";
import { useBrandLookup, useCategoryLookup } from "./lookups";
import { Panel } from "./parts";
import { ReportShell, useReportFilters } from "./ReportShell";
import { ReportTable, type Col } from "./ReportTable";
import { useFormat } from "@/lib/i18n/format";

function useProductFilters(extra: readonly string[] = []) {
  const rf = useReportFilters(["category", "brand", ...extra] as const);
  const categories = useCategoryLookup(), brands = useBrandLookup();
  const filter = { ...rf.filter, categoryId: rf.url.category, brandId: rf.url.brand };
  return { rf, filter, categories, brands };
}

export function TrendingProducts() {
  const t = useTranslations("reports");
  const f = useFormat();
  const { rf, filter, categories, brands } = useProductFilters();
  const [limit, setLimit] = useState("10");
  const { data, isFetching } = useReport("trending", { ...filter, limit }, () => productReports.trending(filter, Number(limit)));
  const rows = data?.rows ?? [];
  const cols: Col<TrendingRow>[] = [
    { key: "label", label: t("product") }, { key: "sku", label: t("sku") }, { key: "sold", label: t("unitsSold"), kind: "qty", total: true }, { key: "revenue", label: t("revenue"), kind: "money", total: true },
  ];
  return (
    <ReportShell
      title={t("trendingTitle")} description={t("trendingDescription")} rf={rf}
      extraDefs={[
        { key: "category", label: t("category"), type: "select", options: categories }, { key: "brand", label: t("brand"), type: "select", options: brands },
      ]}
      actions={
        <Tabs value={limit} onValueChange={setLimit}><TabsList>{["5", "10", "20"].map((n) => <TabsTrigger key={n} value={n}>{t("topN", { n })}</TabsTrigger>)}</TabsList></Tabs>
      }
    >
      {rows.length > 0 && <Panel title={t("topSellers")}><BarChart layout="vertical" data={rows.map((r) => ({ name: r.label, sold: r.sold }))} xKey="name" yKey="sold" label={t("topSellers")} height={Math.max(220, rows.length * 34)} format={(n) => f.qty(n)} /></Panel>}
      <ReportTable id="trending" columns={cols} rows={rows} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}

export function ItemsReport() {
  const t = useTranslations("reports");
  const { rf, filter, categories, brands } = useProductFilters(["supplier", "customer"]);
  const { data: contacts } = useContacts({ pageSize: -1 });
  const people = (type: "supplier" | "customer") => (contacts?.rows ?? []).filter((c) => (type === "supplier" ? c.type !== "customer" : c.type !== "supplier")).map((c) => ({ value: c.id, label: c.name }));
  const f = { ...filter, supplierId: rf.url.supplier, customerId: rf.url.customer };
  const { data, isFetching } = useReport("items", f, () => productReports.items(f));
  const cols: Col<ItemRow>[] = [
    { key: "product", label: t("product") }, { key: "sku", label: t("sku") }, { key: "lotNo", label: t("lotNo") },
    { key: "purchaseRef", label: t("purchaseRef") }, { key: "purchaseDate", label: t("purchaseDate"), kind: "date" }, { key: "supplier", label: t("supplier") }, { key: "purchaseCost", label: t("unitCost"), kind: "money" },
    { key: "saleRef", label: t("saleRef") }, { key: "saleDate", label: t("saleDate"), kind: "date" }, { key: "customer", label: t("customer") },
    { key: "qty", label: t("qty"), kind: "qty", total: true }, { key: "sellPrice", label: t("unitSellPrice"), kind: "money" }, { key: "profit", label: t("profit"), kind: "money", total: true },
  ];
  return (
    <ReportShell
      title={t("itemsTitle")} description={t("itemsDescription")} rf={rf}
      extraDefs={[
        { key: "category", label: t("category"), type: "select", options: categories }, { key: "brand", label: t("brand"), type: "select", options: brands },
        { key: "supplier", label: t("supplier"), type: "select", options: people("supplier") }, { key: "customer", label: t("customer"), type: "select", options: people("customer") },
      ]}
    >
      <ReportTable id="items" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}

const lineCols = (t: ReturnType<typeof useTranslations>, party: string, withCost: boolean, withLot: boolean): Col<LineRow>[] => [
  { key: "date", label: t("date"), kind: "datetime" }, { key: "refNo", label: t("refNo") }, { key: "contactName", label: party }, { key: "locationName", label: t("location") },
  { key: "product", label: t("product") }, { key: "sku", label: t("sku") }, ...(withLot ? [{ key: "lotNo" as const, label: t("lotNo") }] : []),
  { key: "qty", label: t("qty"), kind: "qty", total: true }, { key: "unitPrice", label: t("unitPrice"), kind: "money" }, { key: "tax", label: t("tax"), kind: "money", total: true }, { key: "subtotal", label: t("subtotal"), kind: "money", total: true },
  ...(withCost ? [{ key: "cost" as const, label: t("cost"), kind: "money" as const, total: true }] : []),
];

export function ProductPurchaseReport() {
  const t = useTranslations("reports");
  const { rf, filter, categories, brands } = useProductFilters(["supplier"]);
  const { data: contacts } = useContacts({ type: "supplier", pageSize: -1 });
  const f = { ...filter, contactId: rf.url.supplier };
  const { data, isFetching } = useReport("product-purchase", f, () => productReports.productPurchase(f));
  return (
    <ReportShell
      title={t("productPurchaseTitle")} description={t("productPurchaseDescription")} rf={rf}
      extraDefs={[
        { key: "category", label: t("category"), type: "select", options: categories }, { key: "brand", label: t("brand"), type: "select", options: brands },
        { key: "supplier", label: t("supplier"), type: "select", options: (contacts?.rows ?? []).map((c) => ({ value: c.id, label: c.name })) },
      ]}
    >
      <ReportTable id="product-purchase" columns={lineCols(t, t("supplier"), false, true)} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} getRowId={(r) => r.id} />
    </ReportShell>
  );
}

type SellTab = "detailed" | "lot" | GroupBy;
const SELL_TABS: SellTab[] = ["detailed", "lot", "product", "category", "brand"];

export function ProductSellReport() {
  const t = useTranslations("reports");
  const { rf, filter, categories, brands } = useProductFilters(["customer"]);
  const { data: contacts } = useContacts({ type: "customer", pageSize: -1 });
  const [tab, setTab] = useState<SellTab>("detailed");
  const f = { ...filter, contactId: rf.url.customer };
  const grouped = tab === "product" || tab === "category" || tab === "brand";
  const lines = useReport(`sell-${tab}`, f, () => productReports.productSellDetailed(f, tab === "lot"), !grouped);
  const groups = useReport(`sell-${tab}`, f, () => productReports.productSellGrouped(tab as GroupBy, f), grouped);
  const groupCols: Col<GroupedRow>[] = [
    { key: "label", label: t(`dim.${tab === "lot" || tab === "detailed" ? "product" : tab}`) }, ...(tab === "product" ? [{ key: "sku" as const, label: t("sku") }] : []),
    { key: "qty", label: t("qty"), kind: "qty", total: true }, { key: "subtotal", label: t("subtotal"), kind: "money", total: true }, { key: "cost", label: t("cost"), kind: "money", total: true }, { key: "profit", label: t("profit"), kind: "money", total: true },
  ];
  return (
    <ReportShell
      title={t("productSellTitle")} description={t("productSellDescription")} rf={rf}
      extraDefs={[
        { key: "category", label: t("category"), type: "select", options: categories }, { key: "brand", label: t("brand"), type: "select", options: brands },
        { key: "customer", label: t("customer"), type: "select", options: (contacts?.rows ?? []).map((c) => ({ value: c.id, label: c.name })) },
      ]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as SellTab)}>
        <TabsList className="flex-wrap">{SELL_TABS.map((k) => <TabsTrigger key={k} value={k}>{t(`sellTab.${k}`)}</TabsTrigger>)}</TabsList>
      </Tabs>
      {grouped
        ? <ReportTable id={`sell-${tab}`} columns={groupCols} rows={groups.data?.rows ?? []} totals={groups.data?.totals} loading={groups.isFetching} />
        : <ReportTable id={`sell-${tab}`} columns={lineCols(t, t("customer"), true, tab === "lot")} rows={lines.data?.rows ?? []} totals={lines.data?.totals} loading={lines.isFetching} getRowId={(r) => r.id} />}
    </ReportShell>
  );
}
