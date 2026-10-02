"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { GettingStarted } from "@/features/onboarding/GettingStarted";
import { BanknoteIcon, CircleDollarSignIcon, FileClockIcon, ReceiptIcon, ShoppingBagIcon, TrendingUpIcon, Undo2Icon, WalletIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilterBar, type FilterDef } from "@/components/shared/FilterBar";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import type { Tone } from "@/components/shared/tones";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/lib/auth/useCan";
import { useDashboardKpis } from "@/lib/data/hooks/dashboard";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useReport } from "@/lib/data/hooks/reports";
import type { Kpis } from "@/lib/data/services/dashboard";
import { dashboardReports, type DuePayment } from "@/lib/data/services/reports/dashboard";
import { useFormat } from "@/lib/i18n/format";
import { AreaChart, BarChart } from "./Charts";
import { Panel } from "./parts";
import { useReportFilters } from "./ReportShell";

const CARDS: { key: keyof Kpis; label: string; icon: LucideIcon; tone: Exclude<Tone, "primary"> }[] = [
  { key: "totalSales", label: "totalSales", icon: CircleDollarSignIcon, tone: "default" },
  { key: "net", label: "net", icon: TrendingUpIcon, tone: "success" },
  { key: "invoiceDue", label: "invoiceDue", icon: FileClockIcon, tone: "warning" },
  { key: "sellReturn", label: "totalSellReturn", icon: Undo2Icon, tone: "danger" },
  { key: "totalPurchase", label: "totalPurchase", icon: ShoppingBagIcon, tone: "info" },
  { key: "purchaseDue", label: "purchaseDue", icon: WalletIcon, tone: "warning" },
  { key: "purchaseReturn", label: "totalPurchaseReturn", icon: BanknoteIcon, tone: "danger" },
  { key: "expense", label: "expense", icon: ReceiptIcon, tone: "default" },
];

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function DueTable({ rows, href, empty }: { rows: DuePayment[]; href: (id: string) => string; empty: string }) {
  const t = useTranslations("reports");
  const f = useFormat();
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>{t("refNo")}</TableHead><TableHead>{t("contact")}</TableHead><TableHead>{t("date")}</TableHead><TableHead className="text-right">{t("due")}</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
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
  const kpis = useDashboardKpis({ locationId: loc, from: rf.filter.from!, to: rf.filter.to! });
  const extras = useReport("dashboard", rf.filter, () => dashboardReports.extras(rf.filter));
  const x = extras.data;
  const defs: FilterDef[] = [
    { key: "location", label: common("common.location"), type: "select", options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) },
    { key: "range", label: common("sales.dateRange"), type: "daterange" },
  ];
  return (
    <>
      <GettingStarted />
      <PageHeader title={t("title", { name })} description={t("description")} />
      <div className="mb-4"><FilterBar defs={defs} value={rf.shown} onChange={(p) => rf.setUrl(p)} onReset={rf.resetUrl} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <StatCard key={c.key} label={t(c.label)} icon={c.icon} tone={c.tone} loading={kpis.isPending} value={kpis.data ? f.money(kpis.data[c.key]) : null} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title={r("salesLast30")}>
            {x ? <AreaChart data={x.salesByDay} xKey="date" yKey="sales" label={r("salesLast30")} /> : <div className="h-60" />}
          </Panel>
        </div>
        <Panel title={r("topProducts")}>
          {!x ? <div className="h-60" /> : x.topProducts.length === 0 ? <Empty>{r("empty")}</Empty> : (
            <BarChart layout="vertical" data={x.topProducts.map((p) => ({ name: p.label, sold: p.sold }))} xKey="name" yKey="sold" label={r("topProducts")} height={240} format={(n) => f.qty(n)} />
          )}
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={r("salesDue")}><DueTable rows={x?.salesDue ?? []} href={(id) => `/sales/${id}`} empty={r("noDue")} /></Panel>
        <Panel title={r("purchaseDue")}><DueTable rows={x?.purchasesDue ?? []} href={(id) => `/purchases/${id}`} empty={r("noDue")} /></Panel>
        <Panel title={r("stockAlerts")}>
          {!x?.stockAlerts.length ? <Empty>{r("noStockAlerts")}</Empty> : (
            <Table>
              <TableHeader><TableRow><TableHead>{r("product")}</TableHead><TableHead>{r("location")}</TableHead><TableHead className="text-right">{r("currentStock")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {x.stockAlerts.map((a) => (
                  <TableRow key={`${a.variationId}${a.locationName}`}>
                    <TableCell>{a.variation ? `${a.product} (${a.variation})` : a.product}</TableCell><TableCell>{a.locationName}</TableCell>
                    <TableCell className="text-right tabular text-danger">{f.qty(a.stock)} {a.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
        <Panel title={r("expiryAlerts")}>
          {!x?.expiryAlerts.length ? <Empty>{r("noExpiry")}</Empty> : (
            <Table>
              <TableHeader><TableRow><TableHead>{r("product")}</TableHead><TableHead>{r("expDate")}</TableHead><TableHead className="text-right">{r("qtyLeft")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {x.expiryAlerts.map((a) => (
                  <TableRow key={a.lotId}>
                    <TableCell>{a.variation ? `${a.product} (${a.variation})` : a.product}<div className="text-xs text-muted-foreground">{a.locationName}</div></TableCell>
                    <TableCell className="tabular"><div className="whitespace-nowrap">{f.date(a.expDate)}</div>{a.daysLeft < 0 && <div className="text-xs text-danger">{r("expiredBadge", { n: f.number(-a.daysLeft) })}</div>}</TableCell>
                    <TableCell className="text-right tabular">{f.qty(a.qty)} {a.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
