"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, LayoutGridIcon, LineChartIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useReport } from "@/lib/data/hooks/reports";
import { analyticsReports } from "@/lib/data/services/reports/analytics";
import { useFormat } from "@/lib/i18n/format";
import { DashboardRange } from "@/features/reports/DashboardRange";
import { encodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { ReportShell, useReportFilters, type ReportFilters } from "@/features/reports/ReportShell";
import { ReportTable, type Col } from "@/features/reports/ReportTable";
import { BigMoney, DeltaPill } from "@/features/reports/KpiSummary";
import { Bars, ComboChart, Donut, Heatmap, ParetoChart, StackedBars } from "./charts";
import { CardGrid, GridCard, TileCard, type CardDef } from "./CardGrid";
import { useLayouts } from "./layoutStore";

export const SEGMENTS = ["overview", "sales", "products", "customers", "inventory", "expenses"] as const;
export type Segment = (typeof SEGMENTS)[number];

function Tile({ label, hint, now, before, good, kind = "money" }: { label: string; hint?: string; now?: number; before?: number; good?: "up" | "down"; kind?: "money" | "number" | "percent" }) {
  const f = useFormat();
  return (
    <TileCard>
      <div title={hint}>
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        {now === undefined ? <Skeleton className="mt-3 h-9 w-36 rounded-xl" /> : (
          <div className={cn("mt-2 text-3xl leading-tight font-semibold", now < 0 && "text-danger")}>
            {kind === "money" ? <BigMoney value={now} /> : <span className="tabular tracking-tight">{f.number(now)}{kind === "percent" ? "%" : ""}</span>}
          </div>
        )}
        <div className="mt-1 min-h-6">{now !== undefined && before !== undefined ? <DeltaPill now={now} before={before} good={good} /> : null}</div>
      </div>
    </TileCard>
  );
}

/** Sizes on the 12-column grid: a headline tile, a half-width chart, a full-width chart or table. */
const TILE = { w: 3, h: 4, minW: 2, minH: 4, maxW: 12, maxH: 7 } as const;
const HALF = { w: 6, h: 10, minW: 4, minH: 7, maxW: 12, maxH: 22 } as const;
const FULL = { w: 12, h: 10, minW: 6, minH: 7, maxW: 12, maxH: 22 } as const;

function Chart({ loading, empty, children }: { loading: boolean; empty: boolean; children: ReactNode }) {
  const t = useTranslations("analytics");
  if (loading) return <Skeleton className="h-full min-h-40 w-full rounded-2xl" />;
  if (empty) return <EmptyState icon={LineChartIcon} title={t("emptyTitle")} description={t("emptyHint")} className="py-6" />;
  return <>{children}</>;
}

type SectionProps = { rf: ReportFilters; section: string };

function OverviewSection({ rf, section }: SectionProps) {
  const t = useTranslations("analytics");
  const ov = useReport("analytics-overview", rf.filter, () => analyticsReports.overview(rf.filter));
  const o = ov.data;
  const c = o?.current, p = o?.previous;
  const tile = (id: string, label: string, hint: string | undefined, now: number | undefined, before: number | undefined, good?: "up", kind?: "money" | "number" | "percent"): CardDef => ({
    id, ...TILE, node: <Tile label={label} hint={hint} now={now} before={before} good={good} kind={kind} />,
  });
  return (
    <CardGrid section={section} items={[
      tile("sales", t("netSales"), t("hint.netSales"), c?.sales, p?.sales, "up"),
      tile("gross", t("grossProfit"), t("hint.grossProfit"), c?.grossProfit, p?.grossProfit, "up"),
      tile("net", t("netProfit"), t("hint.netProfit"), c?.netProfit, p?.netProfit, "up"),
      tile("margin", t("margin"), t("hint.margin"), c?.margin, p?.margin, "up", "percent"),
      tile("orders", t("orders"), undefined, c?.orders, p?.orders, "up", "number"),
      tile("aov", t("aov"), t("hint.aov"), c?.aov, p?.aov, "up"),
      tile("recv", t("receivables"), t("hint.receivables"), o?.receivables, undefined),
      tile("pay", t("payables"), t("hint.payables"), o?.payables, undefined),
      { id: "trend", ...FULL, node: (
        <GridCard title={t("salesVsProfit")}>
          <Chart loading={ov.isFetching && !o} empty={!o || o.trend.every((r) => r.sales === 0 && r.profit === 0)}>
            <ComboChart data={o?.trend ?? []} xKey="bucket" bar={{ key: "sales", label: t("netSales") }} line={{ key: "profit", label: t("grossProfit") }} label={t("salesVsProfit")} />
          </Chart>
        </GridCard>
      ) },
    ]} />
  );
}

function SalesSection({ rf, section }: SectionProps) {
  const t = useTranslations("analytics");
  const pm = useTranslations("payMethods");
  const locale = useLocale();
  const f = useFormat();
  const sales = useReport("analytics-sales", rf.filter, () => analyticsReports.sales(rf.filter));
  const s = sales.data;
  const load = sales.isFetching && !s;
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 0, 4 + i)));
  return (
    <CardGrid section={section} items={[
      { id: "heat", w: 12, h: 13, minW: 8, minH: 9, maxW: 12, maxH: 20, node: (
        <GridCard title={t("busiestTimes")} scroll>
          <Chart loading={load} empty={!s || s.heat.flat().every((v) => v === 0)}>
            <Heatmap grid={s?.heat ?? []} rowLabels={weekdays} label={t("busiestTimes")} format={f.money} />
          </Chart>
        </GridCard>
      ) },
      { id: "payment", ...HALF, node: (
        <GridCard title={t("paymentMix")}>
          <Chart loading={load} empty={!s?.byPayment.length}>
            <Donut data={(s?.byPayment ?? []).map((x) => ({ name: pm.has(x.method) ? pm(x.method) : x.method, value: x.amount }))} label={t("paymentMix")} other={t("other")} />
          </Chart>
        </GridCard>
      ) },
      { id: "location", ...HALF, node: (
        <GridCard title={t("byLocation")}>
          <Chart loading={load} empty={!s?.byLocation.length}>
            <Bars layout="vertical" data={s?.byLocation ?? []} xKey="name" yKey="sales" label={t("byLocation")} />
          </Chart>
        </GridCard>
      ) },
      { id: "discounts", ...TILE, node: <Tile label={t("discountsGiven")} now={s?.discounts.given} /> },
      { id: "discountPct", ...TILE, node: <Tile label={t("discountPct")} now={s?.discounts.pctOfSales} kind="percent" /> },
      { id: "returned", ...TILE, node: <Tile label={t("returned")} now={s?.returns.amount} /> },
      { id: "returnRate", ...TILE, node: <Tile label={t("returnRate")} now={s?.returns.pctOfSales} kind="percent" /> },
    ]} />
  );
}

function ProductsSection({ rf, section }: SectionProps) {
  const t = useTranslations("analytics");
  const prod = useReport("analytics-products", rf.filter, () => analyticsReports.products(rf.filter));
  const a = prod.data;
  const load = prod.isFetching && !a;
  const dead: Col<NonNullable<typeof a>["deadStock"][number]>[] = [
    { key: "label", label: t("product") },
    { key: "stock", label: t("onHand"), kind: "qty" },
    { key: "value", label: t("valueAtCost"), kind: "money", total: true },
    { key: "daysSinceSale", label: t("daysSinceSale"), kind: "number" },
  ];
  return (
    <CardGrid section={section} items={[
      { id: "topProfit", ...HALF, h: 11, node: (
        <GridCard title={t("topByProfit")}>
          <Chart loading={load} empty={!a?.topByProfit.length}><Bars layout="horizontal" data={a?.topByProfit ?? []} xKey="label" yKey="profit" label={t("topByProfit")} /></Chart>
        </GridCard>
      ) },
      { id: "topSales", ...HALF, h: 11, node: (
        <GridCard title={t("topBySales")}>
          <Chart loading={load} empty={!a?.topBySales.length}><Bars layout="horizontal" data={a?.topBySales ?? []} xKey="label" yKey="sales" label={t("topBySales")} /></Chart>
        </GridCard>
      ) },
      { id: "abc", ...FULL, node: (
        <GridCard title={t("abc")} subtitle={t("abcHint", { a: a?.classACount ?? 0 })}>
          <Chart loading={load} empty={!a?.pareto.length}>
            <ParetoChart data={a?.pareto ?? []} xKey="label" bar={{ key: "sales", label: t("netSales") }} line={{ key: "cumulative", label: t("cumulative") }} label={t("abc")} />
          </Chart>
        </GridCard>
      ) },
      { id: "dead", ...FULL, h: 10, node: (
        <GridCard title={t("deadStock", { days: a?.deadStockDays ?? 60 })} scroll>
          <ReportTable bare id="dead-stock" columns={dead} rows={a?.deadStock ?? []} loading={load} getRowId={(r) => r.variationId} />
        </GridCard>
      ) },
    ]} />
  );
}

function CustomersSection({ rf, section }: SectionProps) {
  const t = useTranslations("analytics");
  const cust = useReport("analytics-customers", rf.filter, () => analyticsReports.customers(rf.filter));
  const a = cust.data;
  const load = cust.isFetching && !a;
  return (
    <CardGrid section={section} items={[
      { id: "new", ...TILE, node: <Tile label={t("newCustomers")} now={a?.totals.newCustomers} kind="number" /> },
      { id: "returning", ...TILE, node: <Tile label={t("returningCustomers")} now={a?.totals.returning} kind="number" /> },
      { id: "repeat", ...TILE, node: <Tile label={t("repeatRate")} hint={t("hint.repeatRate")} now={a?.totals.repeatRate} kind="percent" /> },
      { id: "owed", ...TILE, node: <Tile label={t("receivables")} hint={t("hint.receivables")} now={a?.aging.reduce((x, r) => x + r.amount, 0)} /> },
      { id: "top", ...HALF, h: 11, node: (
        <GridCard title={t("topCustomers")}>
          <Chart loading={load} empty={!a?.topCustomers.length}><Bars layout="horizontal" data={a?.topCustomers ?? []} xKey="label" yKey="sales" label={t("topCustomers")} /></Chart>
        </GridCard>
      ) },
      { id: "newReturning", ...HALF, h: 11, node: (
        <GridCard title={t("newVsReturning")}>
          <Chart loading={load} empty={!a?.newVsReturning.length}>
            <StackedBars data={a?.newVsReturning ?? []} xKey="bucket" series={[{ key: "newCustomers", label: t("newCustomers") }, { key: "returning", label: t("returningCustomers") }]} label={t("newVsReturning")} />
          </Chart>
        </GridCard>
      ) },
      { id: "aging", ...FULL, h: 9, node: (
        <GridCard title={t("aging")}>
          <Chart loading={load} empty={!a || a.aging.every((r) => r.amount === 0)}>
            <Bars layout="vertical" data={(a?.aging ?? []).map((r) => ({ ...r, bucket: t(`agingBucket.${r.bucket}`) }))} xKey="bucket" yKey="amount" label={t("aging")} />
          </Chart>
        </GridCard>
      ) },
    ]} />
  );
}

function InventorySection({ rf, section }: SectionProps) {
  const t = useTranslations("analytics");
  const reorder = useReport("analytics-reorder", rf.filter, () => analyticsReports.reorder(rf.filter));
  const load = reorder.isFetching && !reorder.data;
  const cols: Col<NonNullable<typeof reorder.data>["rows"][number]>[] = [
    { key: "label", label: t("product") },
    { key: "stock", label: t("onHand"), kind: "qty" },
    { key: "perDay", label: t("soldPerDay"), kind: "qty" },
    { key: "daysLeft", label: t("daysLeft"), kind: "number" },
    { key: "suggest", label: t("reorderQty"), kind: "qty" },
  ];
  return (
    <CardGrid section={section} items={[
      { id: "reorder", ...FULL, h: 11, node: (
        <GridCard title={t("reorder", { days: reorder.data?.coverDays ?? 30 })} subtitle={t("reorderHint")} scroll>
          <ReportTable bare id="reorder" columns={cols} rows={reorder.data?.rows ?? []} loading={load} getRowId={(r) => r.variationId} />
        </GridCard>
      ) },
    ]} />
  );
}

function ExpensesSection({ rf, section }: SectionProps) {
  const t = useTranslations("analytics");
  const exp = useReport("analytics-expenses", rf.filter, () => analyticsReports.expenses(rf.filter));
  const a = exp.data;
  const load = exp.isFetching && !a;
  return (
    <CardGrid section={section} items={[
      { id: "total", ...TILE, w: 6, node: <Tile label={t("totalExpenses")} now={a?.total} /> },
      { id: "ratio", ...TILE, w: 6, node: <Tile label={t("expenseRatio")} hint={t("hint.expenseRatio")} now={a?.ratio} kind="percent" /> },
      { id: "share", ...HALF, node: (
        <GridCard title={t("expenseShare")}>
          <Chart loading={load} empty={!a?.byCategory.length}><Donut data={(a?.byCategory ?? []).map((x) => ({ name: x.label || t("uncategorised"), value: x.amount }))} label={t("expenseShare")} other={t("other")} /></Chart>
        </GridCard>
      ) },
      { id: "category", ...HALF, node: (
        <GridCard title={t("expenseByCategory")}>
          <Chart loading={load} empty={!a?.byCategory.length}><Bars layout="horizontal" data={(a?.byCategory ?? []).map((x) => ({ ...x, label: x.label || t("uncategorised") }))} xKey="label" yKey="amount" label={t("expenseByCategory")} /></Chart>
        </GridCard>
      ) },
    ]} />
  );
}

const SECTION: Record<Segment, (p: SectionProps) => ReactNode> = {
  overview: OverviewSection, sales: SalesSection, products: ProductsSection, customers: CustomersSection, inventory: InventorySection, expenses: ExpensesSection,
};

const RANGE_KEY = "posible:analytics:range";

/**
 * One page per segment, all on the same filters. `with` in the URL adds other segments' charts underneath, so several
 * can be read against one date range; the range is also remembered while moving between segments.
 */
export function Analytics({ segment }: { segment: Segment }) {
  const t = useTranslations("analytics");
  const rf = useReportFilters(["with"] as const);
  const { setUrl } = rf;
  const first = useReport("analytics-first", {}, () => analyticsReports.firstDate());
  const urlRange = rf.url.range;
  useEffect(() => {
    try {
      if (urlRange) sessionStorage.setItem(RANGE_KEY, urlRange);
      else { const saved = sessionStorage.getItem(RANGE_KEY); if (saved) setUrl({ range: saved }); }
    } catch { /* storage blocked: filters just reset per page */ }
  }, [urlRange, setUrl]);

  const extra = (rf.url.with ?? "").split(",").filter((x): x is Segment => (SEGMENTS as readonly string[]).includes(x) && x !== segment);
  const [flash, setFlash] = useState<Segment | null>(null);
  const toggle = (x: Segment) => {
    const adding = !extra.includes(x);
    rf.setUrl({ with: (adding ? [...extra, x] : extra.filter((e) => e !== x)).join(",") });
    if (adding) {
      toast.success(t("addedBelow", { name: t(`tab.${x}`) }), { description: t("addedBelowHint") });
      setFlash(x);
    } else toast(t("removed", { name: t(`tab.${x}`) }));
  };
  // Once the new section has rendered, bring it into view and ring it briefly so it is clear where it landed.
  useEffect(() => {
    if (!flash) return;
    const el = document.getElementById(`analytics-${flash}`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const id = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(id);
  }, [flash]);
  const shown = [segment, ...SEGMENTS.filter((x) => extra.includes(x))];
  const customised = useLayouts((st) => shown.some((x) => st.layouts[x]));
  const resetLayouts = useLayouts((st) => st.reset);

  return (
    <ReportShell title={t(`tab.${segment}`)} description={t("description")} rf={rf} noDate actions={<DashboardRange allFrom={first.data} value={{ from: rf.filter.from!, to: rf.filter.to! }} onChange={(r) => rf.setUrl({ range: r ? encodeRange(r) : undefined })} />}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("compareWith")}>
        <span className="text-sm text-muted-foreground">{t("compareWith")}</span>
        {SEGMENTS.filter((x) => x !== segment).map((x) => (
          <Button key={x} size="sm" variant={extra.includes(x) ? "default" : "outline"} aria-pressed={extra.includes(x)} onClick={() => toggle(x)} className="rounded-full">{extra.includes(x) && <CheckIcon aria-hidden />}{t(`tab.${x}`)}</Button>
        ))}
        {customised && (
          <Button size="sm" variant="ghost" className="ml-auto rounded-full" onClick={() => { shown.forEach((x) => resetLayouts(x)); toast(t("layoutReset")); }}>
            <LayoutGridIcon aria-hidden />{t("resetLayout")}
          </Button>
        )}
      </div>
      {shown.map((x) => {
        const Section = SECTION[x];
        return (
          <section key={x} id={`analytics-${x}`} className={cn("grid scroll-mt-24 gap-4 rounded-3xl transition-shadow duration-500", flash === x && "ring-2 ring-primary/60 ring-offset-8 ring-offset-background")} aria-label={t(`tab.${x}`)}>
            {shown.length > 1 && <h2 className="mt-2 text-lg font-semibold tracking-tight">{t(`tab.${x}`)}</h2>}
            <Section rf={rf} section={x} />
          </section>
        );
      })}
    </ReportShell>
  );
}
