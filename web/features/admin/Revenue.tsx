"use client";

import { useState } from "react";
import { AdminHeader, useAdmin } from "./AdminShell";
import { day, formatMoney, monthlyRevenue } from "./api";
import { BarRow, Empty, Panel, StatCard } from "./parts";

const DAY = 86_400_000;

export function RevenuePage() {
  const { businesses, plans } = useAdmin();
  const [now] = useState(() => Date.now());
  const list = businesses ?? [];
  const paying = list.filter((b) => b.state === "active");
  const mrr = list.reduce((s, b) => s + monthlyRevenue(b), 0);
  const byPlan = plans.map((p) => ({ plan: p, n: paying.filter((b) => b.plan === p.id).length, sum: paying.filter((b) => b.plan === p.id).reduce((s, b) => s + b.priceMonthly, 0) }));
  const renewals = paying.filter((b) => b.expiresAt && new Date(b.expiresAt).getTime() - now <= 30 * DAY).sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));
  const lost = list.filter((b) => b.state !== "active").reduce((s, b) => s + b.priceMonthly, 0);

  // New businesses over the last six months.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), n: 0 };
  });
  for (const b of list) {
    const d = new Date(b.createdAt);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.n++;
  }

  return (
    <>
      <AdminHeader title="Revenue" description="Estimated from active subscriptions at each package's current monthly price. Payments themselves aren't tracked here." />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard loading={!businesses} label="Monthly revenue" count={mrr} format={formatMoney} />
        <StatCard loading={!businesses} label="Yearly run rate" count={mrr * 12} format={formatMoney} />
        <StatCard loading={!businesses} label="Per paying business" value={paying.length ? formatMoney(mrr / paying.length) : "—"} />
        <StatCard loading={!businesses} label="Not paying right now" value={formatMoney(lost)} hint="Switched off or lapsed, per month" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By package" description="Monthly revenue from each package.">
          {byPlan.map(({ plan, n, sum }) => <div key={plan.id} className="mb-3 last:mb-0"><BarRow label={`${plan.label} (${n})`} value={sum} max={Math.max(1, ...byPlan.map((x) => x.sum))} right={formatMoney(sum)} /></div>)}
        </Panel>
        <Panel title="New businesses" description="Accounts opened per month.">
          {months.map((m) => <div key={m.key} className="mb-3 last:mb-0"><BarRow label={m.label} value={m.n} max={Math.max(1, ...months.map((x) => x.n))} right={String(m.n)} /></div>)}
        </Panel>
        <Panel title="Renewals due in 30 days" description="Subscriptions that end soon. Extend them to keep the revenue." className="lg:col-span-2">
          {renewals.length === 0 ? <Empty>No renewals due.</Empty> : (
            <ul className="grid gap-2">
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
    </>
  );
}
