"use client";

import Link from "next/link";
import { useState } from "react";
import { BanknoteIcon, CalendarCheckIcon, PackageIcon, ReceiptIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "cn";
import { CARD } from "@/components/shared/card-surface";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminHeader, useAdmin } from "./AdminShell";
import { day, formatMoney, monthlyRevenue, shortMonth, termText } from "./api";
import { ColumnsChart, RevenueChart } from "./charts";
import { BarRow, BigMoney, Delta, Empty, Panel, StatCard } from "./parts";

const DAY = 86_400_000;

/** Why the chart is empty. While every account is free that is simply true, not a problem to fix. */
function NoPayments() {
  const { businesses } = useAdmin();
  const allFree = !!businesses && businesses.length > 0 && businesses.every((b) => b.free || b.priceMonthly === 0);
  return (
    <Empty icon={BanknoteIcon} action={<Button asChild variant="outline" className="rounded-full"><Link href="/admin/businesses">See businesses</Link></Button>}>
      {allFree
        ? "No money to show yet: every account is free right now. When a business is on a paid package and you activate it, what you receive shows up here."
        : "No payments recorded yet. Activate a subscription after a payment arrives and what you received shows up here."}
    </Empty>
  );
}

function Failed() {
  const { reload } = useAdmin();
  return (
    <Empty icon={RefreshCwIcon} action={<Button variant="outline" className="rounded-full" onClick={() => void reload()}>Try again</Button>}>
      We couldn&apos;t load the revenue figures. Your records are safe. Check the connection and try again.
    </Empty>
  );
}

/** Total earned, this month against last, and the 12-month chart. Used on the dashboard and at the top of Revenue. */
export function RevenueSummary({ compact }: { compact?: boolean }) {
  const { revenue } = useAdmin();
  return (
    <section aria-label="Revenue" className={cn(CARD, "grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center")}>
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-muted-foreground">Total earned from subscriptions</h2>
        {revenue === null ? (
          <>
            <Skeleton className="mt-3 h-11 w-56 max-w-full rounded-xl" />
            <Skeleton className="mt-3 h-6 w-40 rounded-full" />
          </>
        ) : revenue === undefined ? <Failed /> : (
          <>
            <div className="mt-2 text-4xl leading-tight font-semibold sm:text-5xl"><BigMoney value={revenue.total} /></div>
            <div className="mt-2"><Delta now={revenue.thisMonth} before={revenue.lastMonth} label="this month vs last" /></div>
            <p className="mt-5 text-sm">{formatMoney(revenue.thisMonth)} received this month</p>
            <p className="mt-1 text-sm text-muted-foreground">{revenue.firstPaymentAt ? `${revenue.payments} payment${revenue.payments === 1 ? "" : "s"} since ${day(revenue.firstPaymentAt)}` : "Nothing recorded yet"}</p>
            {compact && <p className="mt-4 text-sm"><Link href="/admin/revenue" className="text-primary hover:underline">See the full breakdown</Link></p>}
          </>
        )}
      </div>
      <div className="min-w-0">
        {revenue === null ? <Skeleton className="h-60 w-full rounded-2xl" /> : revenue === undefined ? null : revenue.payments === 0 ? <NoPayments /> : <RevenueChart report={revenue} height={compact ? 220 : 260} />}
      </div>
    </section>
  );
}

export function RevenuePage() {
  const { businesses, revenue } = useAdmin();
  const [now] = useState(() => Date.now());
  const list = businesses ?? [];
  const paying = list.filter((b) => b.state === "active" && b.priceMonthly > 0);
  const mrr = list.reduce((s, b) => s + monthlyRevenue(b), 0);
  const renewals = list.filter((b) => b.state === "active" && b.expiresAt && new Date(b.expiresAt).getTime() - now <= 30 * DAY).sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));
  const lost = list.filter((b) => b.state !== "active").reduce((s, b) => s + b.priceMonthly, 0);
  const loading = revenue === null;
  const paid = revenue && revenue.payments > 0 ? revenue : null;

  // New businesses over the last 12 months, on the same month axis as the revenue chart.
  const joined = (revenue?.months ?? []).map((m) => ({ label: shortMonth(m.month), key: m.month, value: 0 }));
  for (const b of list) {
    const k = `${new Date(b.createdAt).getFullYear()}-${String(new Date(b.createdAt).getMonth() + 1).padStart(2, "0")}`;
    const m = joined.find((x) => x.key === k);
    if (m) m.value++;
  }
  const byPlanMax = Math.max(1, ...(revenue?.byPlan.map((p) => p.amount) ?? [1]));

  return (
    <>
      <AdminHeader title="Revenue" description="Money you've received for subscriptions, and what's coming in each month." />
      <RevenueSummary />
      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={loading && !businesses} label="Monthly run rate" count={mrr} money hint={`From ${paying.length} paying business${paying.length === 1 ? "" : "es"}`} />
        <StatCard loading={!businesses} label="Yearly run rate" count={mrr * 12} money hint="Run rate times twelve" />
        <StatCard loading={loading} label="Average payment" count={paid ? paid.total / paid.payments : 0} money hint={paid ? `Across ${paid.payments} payments` : "No payments yet"} />
        <StatCard loading={!businesses} label="Not paying right now" count={lost} money hint="Switched off or lapsed, per month" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest payments" description="The most recent money received.">
          {loading ? <Skeleton className="h-40 w-full rounded-2xl" /> : !paid || paid.recent.length === 0 ? <Empty icon={ReceiptIcon}>No payments to list yet. Each activation you record appears here.</Empty> : (
            <ul className="grid gap-3">
              {paid.recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.businessName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.planLabel} · {p.terms} × {termText(p.periodUnit, p.periodCount)} · {day(p.paidAt)}{p.reference ? ` · ${p.reference}` : ""}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="By package" description="Money received per package, all time.">
          {loading ? <Skeleton className="h-24 w-full rounded-2xl" /> : !paid || paid.byPlan.length === 0 ? <Empty icon={PackageIcon}>Money per package shows up after the first payment.</Empty> : paid.byPlan.map((p) => (
            <div key={p.plan} className="mb-3 last:mb-0"><BarRow label={p.label} value={p.amount} max={byPlanMax} right={formatMoney(p.amount)} /></div>
          ))}
        </Panel>
        <Panel title="New businesses" description="Accounts opened each month.">
          {loading ? <Skeleton className="h-40 w-full rounded-2xl" /> : <ColumnsChart data={joined} name="New businesses" height={170} />}
        </Panel>
        <Panel title="Renewals due in 30 days" description="Subscriptions that end soon. Activate them again to keep the revenue.">
          {!businesses ? <Skeleton className="h-20 w-full rounded-2xl" /> : renewals.length === 0 ? <Empty icon={CalendarCheckIcon}>No renewals due in the next 30 days.</Empty> : (
            <ul className="grid gap-3">
              {renewals.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{day(b.expiresAt)} · {formatMoney(b.priceMonthly)}/month</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="px-1 text-xs text-muted-foreground">Only real payments count: one is recorded, dated that day, each time you activate a paid subscription. Free accounts never add to revenue. Run rate spreads each package price over 30 days.</p>
    </>
  );
}
