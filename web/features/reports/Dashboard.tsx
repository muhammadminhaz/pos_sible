"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { GettingStarted } from "@/features/onboarding/GettingStarted";
import { useTranslations } from "next-intl";
import { FilterBar, type FilterDef } from "@/components/shared/FilterBar";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/lib/auth/useCan";
import { useDashboardKpis } from "@/lib/data/hooks/dashboard";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useReport } from "@/lib/data/hooks/reports";
import { encodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { previousRange } from "@/lib/domain/dateRanges";
import { dashboardReports, type DuePayment } from "@/lib/data/services/reports/dashboard";
import { useFormat } from "@/lib/i18n/format";
import { AreaChart, BarChart } from "./Charts";
import { DashboardRange } from "./DashboardRange";
import { CARD, GoButton, KpiSummary, MoneyOut } from "./KpiSummary";
import { useReportFilters } from "./ReportShell";

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-muted/60 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** A dashboard block: round card, title on the left, optional arrow to the full report on the right. */
function Block({ title, href, children, className, order }: { title: string; href?: string; children: ReactNode; className?: string; order: number }) {
  const t = useTranslations("dashboard");
  return (
    <section style={{ "--i": order } as CSSProperties} className={`${CARD} ${className ?? ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {href ? <GoButton href={href} label={`${t("open")}: ${title}`} /> : null}
      </div>
      {children}
    </section>
  );
}

const pill = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";
const tableRow = "border-border/60 hover:bg-muted/40";

function DueTable({ rows, href, empty }: { rows: DuePayment[]; href: (id: string) => string; empty: string }) {
  const t = useTranslations("reports");
  const f = useFormat();
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <Table>
      <TableHeader><TableRow className="border-border/60 hover:bg-transparent"><TableHead>{t("refNo")}</TableHead><TableHead>{t("contact")}</TableHead><TableHead>{t("date")}</TableHead><TableHead className="text-right">{t("due")}</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className={tableRow}>
            <TableCell><Link href={href(r.id)} className="font-medium tabular underline-offset-4 hover:underline">{r.refNo}</Link></TableCell>
            <TableCell>{r.contactName || "—"}</TableCell>
            <TableCell className="whitespace-nowrap tabular">{f.date(r.date)}</TableCell>
            <TableCell className="text-right"><Money value={r.due} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Dashboard() {
  const t = useTranslations("dashboard");
  const r = useTranslations("reports");
  const common = useTranslations();
  const f = useFormat();
  const name = useCurrentUser()?.user.firstName ?? "";
  const { data: lookups } = useLookups();
  const rf = useReportFilters();
  const loc = rf.filter.locationId ?? "all";
  const range = rf.filter.from && rf.filter.to ? { from: rf.filter.from, to: rf.filter.to } : undefined;
  const kpis = useDashboardKpis({ locationId: loc, ...range });
  const previous = range ? previousRange(range) : undefined;
  const prev = useDashboardKpis({ locationId: loc, ...previous }, !!previous);
  const extras = useReport("dashboard", rf.filter, () => dashboardReports.extras(rf.filter));
  const x = extras.data;
  const defs: FilterDef[] = [
    { key: "location", label: common("common.location"), type: "select", options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) },
  ];
  // Charts read their colour from --chart-1; both follow the accent colour.
  const accent = { "--chart-1": "var(--primary)" } as CSSProperties;
  return (
    <>
      <GettingStarted />
      <PageHeader
        title={t("title", { name })}
        description={t("description")}
        actions={<DashboardRange value={range} onChange={(r) => rf.setUrl({ range: r ? encodeRange(r) : undefined })} />}
      />
      <div className="mb-4"><FilterBar defs={defs} value={rf.shown} onChange={(p) => rf.setUrl(p)} onReset={rf.resetUrl} /></div>

      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-[2rem] bg-muted/70 p-3 sm:p-4 dark:bg-muted/25">
        <KpiSummary now={kpis.data} before={prev.data} loading={kpis.isPending} />

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="xl:col-span-3"><MoneyOut now={kpis.data} before={prev.data} loading={kpis.isPending} /></div>
          <Block order={5} title={t("salesPeriod")} href="/sales" className="xl:col-span-5">
            <div style={accent}>{x ? <AreaChart data={x.salesByDay} xKey="date" yKey="sales" label={t("salesTrend")} height={300} /> : <div className="h-75" />}</div>
          </Block>
          <Block order={6} title={r("topProducts")} href="/reports/trending-products" className="xl:col-span-4">
            <div style={accent}>
              {!x ? <div className="h-75" /> : x.topProducts.length === 0 ? <Empty>{r("empty")}</Empty> : (
                <BarChart layout="vertical" data={x.topProducts.map((p) => ({ name: p.label, sold: p.sold }))} xKey="name" yKey="sold" label={r("topProducts")} height={300} format={(n) => f.qty(n)} axisTitle={r("unitsSold")} />
              )}
            </div>
          </Block>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Block order={7} title={r("salesDue")} href="/sales"><DueTable rows={x?.salesDue ?? []} href={(id) => `/sales/${id}`} empty={r("noDue")} /></Block>
          <Block order={8} title={r("purchaseDue")} href="/purchases"><DueTable rows={x?.purchasesDue ?? []} href={(id) => `/purchases/${id}`} empty={r("noDue")} /></Block>
          <Block order={9} title={r("stockAlerts")} href="/reports/stock">
            {!x?.stockAlerts.length ? <Empty>{r("noStockAlerts")}</Empty> : (
              <Table>
                <TableHeader><TableRow className="border-border/60 hover:bg-transparent"><TableHead>{r("product")}</TableHead><TableHead>{r("location")}</TableHead><TableHead className="text-right">{r("currentStock")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {x.stockAlerts.map((a) => (
                    <TableRow key={`${a.variationId}${a.locationName}`} className={tableRow}>
                      <TableCell>{a.variation ? `${a.product} (${a.variation})` : a.product}</TableCell><TableCell>{a.locationName}</TableCell>
                      <TableCell className="text-right"><span className={`${pill} bg-danger-soft text-danger-foreground tabular`}>{f.qty(a.stock)} {a.unit}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Block>
          <Block order={10} title={r("expiryAlerts")} href="/reports/stock-expiry">
            {!x?.expiryAlerts.length ? <Empty>{r("noExpiry")}</Empty> : (
              <Table>
                <TableHeader><TableRow className="border-border/60 hover:bg-transparent"><TableHead>{r("product")}</TableHead><TableHead>{r("expDate")}</TableHead><TableHead className="text-right">{r("qtyLeft")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {x.expiryAlerts.map((a) => (
                    <TableRow key={a.lotId} className={tableRow}>
                      <TableCell>{a.variation ? `${a.product} (${a.variation})` : a.product}<div className="text-xs text-muted-foreground">{a.locationName}</div></TableCell>
                      <TableCell className="tabular">
                        <div className="whitespace-nowrap">{f.date(a.expDate)}</div>
                        {a.daysLeft < 0
                          ? <span className={`${pill} mt-1 bg-danger-soft text-danger-foreground`}>{r("expiredBadge", { n: f.number(-a.daysLeft) })}</span>
                          : <span className={`${pill} mt-1 bg-warning-soft text-warning-foreground`}>{t("leftPill", { n: f.number(a.daysLeft) })}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular">{f.qty(a.qty)} {a.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Block>
        </div>
      </div>
    </>
  );
}
