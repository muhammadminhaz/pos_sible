"use client";

import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { GettingStarted } from "@/features/onboarding/GettingStarted";
import { useLocale, useTranslations } from "next-intl";
import { FilterBar, type FilterDef } from "@/components/shared/FilterBar";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { TypingAnimation } from "@/components/ui/typing-animation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/lib/auth/useCan";
import { useDashboardKpis } from "@/lib/data/hooks/dashboard";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useReport } from "@/lib/data/hooks/reports";
import { encodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { useRangeContext } from "@/components/shared/DateRangePicker";
import { presetRange, previousRange } from "@/lib/domain/dateRanges";
import { dashboardReports, type DuePayment, type StockAlert } from "@/lib/data/services/reports/dashboard";
import type { ExpiryRow } from "@/lib/data/services/reports/stock";
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
        <h2 className="text-base font-semibold">{title}</h2>
        {href ? <GoButton href={href} label={`${t("open")}: ${title}`} /> : null}
      </div>
      {children}
    </section>
  );
}

const pill = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";
const tableRow = "border-border/60 hover:bg-muted/40";

/** Products running low: name and place on the left, what is left against the alert level on the right. Same row rhythm as the expiry list beside it. */
function StockList({ rows }: { rows: StockAlert[] }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((a) => (
        <li key={`${a.variationId}${a.locationName}`} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{a.variation ? `${a.product} (${a.variation})` : a.product}</div>
            <div className="truncate text-xs text-muted-foreground">{a.locationName}</div>
          </div>
          <div className="grid shrink-0 justify-items-end gap-1">
            <span className={`${pill} py-0.5 bg-danger-soft text-danger-foreground tabular`}>{f.qty(a.stock)} {a.unit}</span>
            <span className="text-xs text-muted-foreground tabular">{t("alertAt", { n: f.qty(a.alertQty) })}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Lots past or near their expiry: a count per group, then each lot with its date as a small calendar tile. */
function ExpiryList({ rows, count }: { rows: ExpiryRow[]; count: { expired: number; soon: number } }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const locale = useLocale();
  const month = new Intl.DateTimeFormat(locale, { month: "short" });
  const groups = [
    { key: "expired", label: t("expiredGroup"), n: count.expired, rows: rows.filter((a) => a.daysLeft < 0), tone: "bg-danger-soft text-danger-foreground" },
    { key: "soon", label: t("expiringSoon"), n: count.soon, rows: rows.filter((a) => a.daysLeft >= 0), tone: "bg-warning-soft text-warning-foreground" },
  ];
  const total = count.expired + count.soon;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-2">
        {groups.map((g) => (
          <div key={g.key} className="rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="text-xl font-semibold tabular">{f.number(g.n)}</div>
            <div className="text-xs text-muted-foreground">{g.label}</div>
          </div>
        ))}
      </div>
      {groups.filter((g) => g.rows.length).map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">{g.label}</h3>
          <ul className="divide-y divide-border/60">
            {g.rows.map((a) => {
              const d = new Date(`${a.expDate}T00:00:00`);
              return (
                <li key={a.lotId} className="flex items-center gap-3 py-2.5">
                  <div className="grid w-11 shrink-0 place-items-center rounded-lg bg-muted/60 py-1 leading-none" title={f.date(a.expDate)}>
                    <span className="text-base font-semibold tabular">{f.number(d.getDate())}</span>
                    <span className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground uppercase">{month.format(d)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.variation ? `${a.product} (${a.variation})` : a.product}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.lotNo ? `${a.locationName} · ${t("lotNo", { lot: a.lotNo })}` : a.locationName}</div>
                  </div>
                  <div className="grid shrink-0 justify-items-end gap-1">
                    <div className="text-sm tabular">{f.qty(a.qty)} <span className="text-xs text-muted-foreground">{a.unit}</span></div>
                    <span className={`${pill} py-0.5 ${g.tone}`}>{a.daysLeft < 0 ? t("daysAgo", { n: -a.daysLeft }) : t("inDays", { n: a.daysLeft })}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {total > rows.length && (
        <Link href="/reports/stock-expiry" className="justify-self-start text-sm font-medium text-primary underline-offset-4 hover:underline">{t("viewAllLots", { n: total })}</Link>
      )}
    </div>
  );
}

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

const subscribeNone = () => () => {};
const hourNow = () => new Date().getHours();
// 0-4 is "late": the shop is closed and nobody wants "Good Afternoon" at midnight, or "Good Night" from a dashboard.
const periodOf = (h: number) => (h < 0 ? null : h < 5 ? "late" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening");
const VARIANTS = 4;

/** A time-of-day greeting, typed out. One of several lines is picked per visit; blank on the server so it never mismatches the visitor's clock. */
function useGreeting(name: string): { title: ReactNode; description: ReactNode } {
  const t = useTranslations("dashboard.greeting");
  const period = periodOf(useSyncExternalStore(subscribeNone, hourNow, () => -1));
  const [pick] = useState(() => Math.floor(Math.random() * VARIANTS) + 1); // only read after hydration, when the period is known
  if (!period) return { title: "\u00a0", description: "\u00a0" };
  const title = t(`${period}.${pick}.title`, { name });
  const subtitle = t(`${period}.${pick}.subtitle`);
  return {
    title: <TypingAnimation showCursor={false} duration={55} className="leading-tight tracking-tight">{title}</TypingAnimation>,
    description: <TypingAnimation duration={22} delay={title.length * 55 + 250} blinkCursor={false} className="leading-normal tracking-normal">{subtitle}</TypingAnimation>,
  };
}

export function Dashboard() {
  const t = useTranslations("dashboard");
  const r = useTranslations("reports");
  const common = useTranslations();
  const f = useFormat();
  const name = useCurrentUser()?.user.firstName ?? "";
  const greeting = useGreeting(name);
  const { data: lookups } = useLookups();
  const rf = useReportFilters();
  const { today, fyStartMonth } = useRangeContext();
  const loc = rf.filter.locationId ?? "all";
  const range = rf.filter.from && rf.filter.to ? { from: rf.filter.from, to: rf.filter.to } : presetRange("thisMonth", today, fyStartMonth);
  const kpis = useDashboardKpis({ locationId: loc, ...range });
  const prev = useDashboardKpis({ locationId: loc, ...previousRange(range) });
  const extras = useReport("dashboard", rf.filter, () => dashboardReports.extras(rf.filter));
  const first = useReport("dashboard-first", {}, () => dashboardReports.firstDate());
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
        title={greeting.title}
        description={greeting.description}
        actions={<DashboardRange allFrom={first.data ?? undefined} value={range} onChange={(r) => rf.setUrl({ range: r ? encodeRange(r) : undefined })} />}
      />
      <div className="mb-4"><FilterBar defs={defs} value={rf.shown} onChange={(p) => rf.setUrl(p)} onReset={rf.resetUrl} /></div>

      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-[2rem] bg-muted/70 p-3 sm:p-4 dark:bg-muted/25">
        <KpiSummary now={kpis.data} before={prev.data} loading={kpis.isPending} />

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="xl:col-span-3"><MoneyOut now={kpis.data} loading={kpis.isPending} /></div>
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
            {!x?.stockAlerts.length ? <Empty>{r("noStockAlerts")}</Empty> : <StockList rows={x.stockAlerts} />}
          </Block>
          <Block order={10} title={r("expiryAlerts")} href="/reports/stock-expiry">
            {!x?.expiryAlerts.length ? <Empty>{r("noExpiry")}</Empty> : <ExpiryList rows={x.expiryAlerts} count={x.expiryCount} />}
          </Block>
        </div>
      </div>
    </>
  );
}
