"use client";

import Link from "next/link";
import { Building2Icon, CircleCheckIcon, DatabaseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AdminHeader, useAdmin } from "./AdminShell";
import { day, formatBytes, monthlyRevenue } from "./api";
import { RevenueSummary } from "./Revenue";
import { BarRow, Empty, Panel, StateBadge, StatCard } from "./parts";

const DAY = 86_400_000;

export function DashboardPage() {
  const { businesses, plans } = useAdmin();
  const [now] = useState(() => Date.now());
  const list = businesses ?? [];
  const attention = list.filter((b) => b.state !== "active" || (b.expiresAt && new Date(b.expiresAt).getTime() - now < 14 * DAY));
  const biggest = [...list].sort((a, b) => b.storageBytes - a.storageBytes).slice(0, 5);
  const mix = plans.map((p) => ({ plan: p, n: list.filter((b) => b.plan === p.id).length }));

  return (
    <>
      <AdminHeader title="Dashboard" description="How the platform is doing. Totals only: each business's own data stays private to it." />
      <RevenueSummary compact />
      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={!businesses} label="Businesses" count={list.length} hint={`${list.filter((b) => b.state === "active").length} with an active subscription`} />
        <StatCard loading={!businesses} label="Monthly run rate" count={list.reduce((s, b) => s + monthlyRevenue(b), 0)} money hint="From active subscriptions" />
        <StatCard loading={!businesses} label="User accounts" count={list.reduce((s, b) => s + b.users, 0)} />
        <StatCard loading={!businesses} label="Storage used" count={list.reduce((s, b) => s + b.storageBytes, 0)} format={formatBytes} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Needs attention" description="Switched off, lapsed, or ending within two weeks.">
          {attention.length === 0 ? <Empty icon={CircleCheckIcon}>Nothing to chase right now. Every subscription is in good shape.</Empty> : (
            <ul className="grid gap-2">
              {attention.slice(0, 6).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {day(b.expiresAt)}
                    <StateBadge state={b.state} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Packages" description="Businesses on each package.">
          {mix.map(({ plan, n }) => <div key={plan.id} className="mb-3 last:mb-0"><BarRow label={plan.label} value={n} max={Math.max(1, ...mix.map((m) => m.n))} right={`${n} business${n === 1 ? "" : "es"}`} /></div>)}
        </Panel>
        <Panel title="Newest businesses">
          {list.length === 0 ? <Empty icon={Building2Icon} action={<Button asChild className="rounded-full"><Link href="/admin/businesses">Add a business</Link></Button>}>No business accounts yet. Add the first one to start.</Empty> : (
            <ul className="grid gap-2">
              {list.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="shrink-0 text-muted-foreground">{b.planLabel} · {day(b.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-sm"><Link href="/admin/businesses" className="text-primary hover:underline">All businesses</Link></div>
        </Panel>
        <Panel title="Most storage" description="Space the records take in the database.">
          {biggest.length === 0 ? <Empty icon={DatabaseIcon}>Nothing stored yet.</Empty> : biggest.map((b) => <div key={b.id} className="mb-3 last:mb-0"><BarRow label={b.name} value={b.storageBytes} max={biggest[0].storageBytes} right={formatBytes(b.storageBytes)} /></div>)}
        </Panel>
      </div>
    </>
  );
}
