"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { CARD } from "@/components/shared/card-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/lib/useCountUp";
import type { Kpis } from "@/lib/data/services/dashboard";
import { useFormat } from "@/lib/i18n/format";

type Key = keyof Kpis;

export { CARD };

/** Small round arrow that opens whatever the block summarises. */
export function GoButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-foreground transition-all hover:-translate-y-0.5 hover:rotate-12 hover:bg-foreground hover:text-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowUpRightIcon className="size-4" aria-hidden />
    </Link>
  );
}

/** A large figure with its currency symbol shrunk and lifted, easing up to its value. */
export function BigMoney({ value, className }: { value: number; className?: string }) {
  const f = useFormat();
  const shown = useCountUp(value) ?? value;
  const text = f.money(shown);
  const m = /^(\D*?)(\d.*)$/.exec(text);
  return (
    <span className={cn("tabular tracking-tight", className)}>
      {m ? <><span className="mr-1 align-[0.55em] text-[0.45em] font-medium text-muted-foreground">{m[1]}</span>{m[2]}</> : text}
    </span>
  );
}

/** Change against the previous period as a pill; the colour says whether the direction is good news. */
export function DeltaPill({ now, before, good }: { now: number; before?: number; good?: "up" | "down" }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  if (before === undefined) return <span className="block h-6" aria-hidden />;
  // ponytail: nothing before means all of it is new, so it reads as ±100%
  const pct = before === 0 ? (Math.sign(now) || 0) * 100 : ((now - before) / Math.abs(before)) * 100;
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const verdict = flat || !good ? "neutral" : (up ? "up" : "down") === good ? "good" : "bad";
  const tone = { neutral: "bg-muted text-muted-foreground", good: "bg-success-soft text-success-foreground", bad: "bg-danger-soft text-danger-foreground" }[verdict];
  const Icon = flat ? MinusIcon : up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold", tone)}>
        <Icon className="size-3.5" aria-hidden />
        <span className="tabular">{`${up ? "+" : ""}${f.number(Math.round(pct * 10) / 10)}%`}</span>
      </span>
      <span className="text-muted-foreground">{t("vsPrevious")}</span>
    </span>
  );
}

/** A thick pill bar: the filled part is this figure's share of the whole. */
function ShareBar({ pct, tone }: { pct: number; tone: "ink" | "accent" }) {
  return (
    <div className="h-9 overflow-hidden rounded-full bg-muted" role="presentation">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone === "ink" ? "bg-foreground" : "bg-primary")}
        style={{ width: pct > 0 ? `${Math.max(pct, 4)}%` : 0 }}
      />
    </div>
  );
}

function Headline({ label, value, before, good, due, kind, salesTotal, tone, href, loading, order }: {
  order: number; label: string; value?: number; before?: number; good?: "up" | "down"; due?: number; kind: "collect" | "pay" | "spend"; salesTotal?: number; tone: "ink" | "accent"; href: string; loading: boolean;
}) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  // Sales and purchases show how much is settled; expense shows how much of the sales it ate.
  const paidPct = kind === "spend"
    ? (value !== undefined && salesTotal && salesTotal > 0 ? clamp((value / salesTotal) * 100) : null)
    : (value && value > 0 && due !== undefined ? clamp(((value - due) / value) * 100) : null);
  return (
    <section style={{ "--i": order } as CSSProperties} className={`${CARD} h-full`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <GoButton href={href} label={`${t("open")}: ${label}`} />
      </div>
      {loading || value === undefined ? (
        <Skeleton className="mt-3 h-11 w-48 rounded-xl" />
      ) : (
        <div className={cn("mt-2 text-3xl leading-tight font-semibold", value < 0 && "text-danger")}><BigMoney value={value} /></div>
      )}
      <div className="mt-1 min-h-6">{value !== undefined && !loading ? <DeltaPill now={value} before={before} good={good} /> : null}</div>
      <div className="mt-4"><ShareBar pct={paidPct ?? 0} tone={tone} /></div>
      <p className="mt-2 text-xs text-muted-foreground tabular">{paidPct !== null
          ? t(kind === "collect" ? "collectedOfSales" : kind === "pay" ? "paidOfPurchases" : "spentOfSales", { pct: f.number(Math.floor(paidPct)), due: f.money(due ?? 0) })
          : loading || value === undefined ? "\u00a0" : t(kind === "collect" ? "emptySales" : kind === "pay" ? "emptyPurchases" : value === 0 ? "emptyExpense" : "noSalesToCompare")}</p>
    </section>
  );
}

/** The focal card: what the business actually kept, on the usual surface with a faint accent wash. */
function NetCard({ now, before, loading }: { now?: Kpis; before?: Kpis; loading: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const net = now?.net;
  const margin = now && now.totalSales > 0 ? Math.round(((now.net / now.totalSales) * 100) * 10) / 10 : null;
  return (
    <section style={{ "--i": 3 } as CSSProperties} className={`${CARD} h-full`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{t("net")}</h3>
        <GoButton href="/reports/profit-loss" label={`${t("open")}: ${t("net")}`} />
      </div>
      {loading || net === undefined ? (
        <Skeleton className="mt-3 h-11 w-48 rounded-xl" />
      ) : (
        <div className={cn("mt-2 text-3xl leading-tight font-semibold", net < 0 && "text-danger")}><BigMoney value={net} /></div>
      )}
      <div className="mt-1 min-h-6">{net !== undefined && !loading ? <DeltaPill now={net} before={before?.net} good="up" /> : null}</div>
      <div className="mt-4"><ShareBar pct={Math.min(100, Math.max(0, margin ?? 0))} tone="ink" /></div>
      <p className="mt-2 text-xs text-muted-foreground tabular">{margin !== null ? t("ofSales", { pct: f.number(margin) }) : loading || net === undefined ? "\u00a0" : t("emptyProfit")}</p>
    </section>
  );
}

export function KpiSummary({ now, before, loading }: { now?: Kpis; before?: Kpis; loading: boolean }) {
  const t = useTranslations("dashboard");
  return (
    <section aria-label={t("salesPeriod")} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Headline order={0} label={t("totalSales")} value={now?.totalSales} before={before?.totalSales} good="up" due={now?.invoiceDue} kind="collect" tone="ink" href="/sales" loading={loading} />
      <Headline order={1} label={t("totalPurchase")} value={now?.totalPurchase} before={before?.totalPurchase} good="up" due={now?.purchaseDue} kind="pay" tone="ink" href="/purchases" loading={loading} />
      <Headline order={2} label={t("expense")} value={now?.expense} before={before?.expense} good="down" kind="spend" salesTotal={now?.totalSales} tone="ink" href="/expenses" loading={loading} />
      <div className="[&>section]:h-full"><NetCard now={now} before={before} loading={loading} /></div>
    </section>
  );
}

/** Money going out and money owed, as one calm list under the headline cards. */
export function MoneyOut({ now, loading }: { now?: Kpis; loading: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const rows: { key: Key; label: string; warn?: boolean; href: string }[] = [
    { key: "invoiceDue", label: "invoiceDue", warn: true, href: "/sales" },
    { key: "purchaseDue", label: "purchaseDue", warn: true, href: "/purchases" },
    { key: "sellReturn", label: "totalSellReturn", href: "/sales/returns" },
    { key: "purchaseReturn", label: "totalPurchaseReturn", href: "/purchases/returns" },
  ];
  return (
    <div className="grid h-full min-w-0 grid-cols-1 gap-3">
      <section style={{ "--i": 4 } as CSSProperties} className={`${CARD} flex h-full flex-col`} aria-label={t("owedAndReturned")}>
        <h2 className="mb-2 text-base font-semibold tracking-tight">{t("owedAndReturned")}</h2>
        <ul className="flex flex-1 flex-col divide-y divide-border/70">
          {rows.map((r) => {
            const v = now?.[r.key];
            return (
              <li key={r.key} className="flex flex-1 items-center justify-between gap-3 py-3">
                <Link href={r.href} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t(r.label)}</Link>
                {loading || v === undefined ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <span className={cn("rounded-full px-3 py-1 text-sm font-semibold tabular", r.warn && v > 0 ? "bg-warning-soft text-warning-foreground" : v === 0 ? "text-muted-foreground" : "bg-muted")}>{f.money(v)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
