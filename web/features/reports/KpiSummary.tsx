"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/lib/useCountUp";
import type { Kpis } from "@/lib/data/services/dashboard";
import { useFormat } from "@/lib/i18n/format";

type Key = keyof Kpis;

/** The surface every dashboard block sits on: big radius, no outline, a whisper of shadow. */
export const CARD = "reveal card-glow min-w-0 rounded-3xl bg-card p-5 shadow-[0_1px_0_rgb(0_0_0/0.03),0_14px_30px_-18px_rgb(0_0_0/0.18)] sm:p-6";

/** The faint accent wash the three headline cards share, strongest in the top-left corner. */
const TINT = "bg-gradient-to-br from-primary/12 via-card to-card";

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
  if (before === undefined || before === 0) return <span className="block h-6" aria-hidden />;
  const pct = ((now - before) / Math.abs(before)) * 100;
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
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone === "ink" ? "bg-foreground" : "bg-warning")}
        style={{ width: pct > 0 ? `${Math.max(pct, 4)}%` : 0 }}
      />
    </div>
  );
}

function Headline({ label, value, before, good, share, tone, href, loading, order }: {
  order: number; label: string; value?: number; before?: number; good?: "up" | "down"; share: number; tone: "ink" | "accent"; href: string; loading: boolean;
}) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  return (
    <section style={{ "--i": order } as CSSProperties} className={`${CARD} ${TINT} h-full`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <GoButton href={href} label={`${t("open")}: ${label}`} />
      </div>
      {loading || value === undefined ? (
        <Skeleton className="mt-3 h-11 w-48 rounded-xl" />
      ) : (
        <div className={cn("mt-2 text-3xl leading-tight sm:text-[2.5rem] font-semibold", value < 0 && "text-danger")}><BigMoney value={value} /></div>
      )}
      <div className="mt-1 min-h-6">{value !== undefined && !loading ? <DeltaPill now={value} before={before} good={good} /> : null}</div>
      <div className="mt-4"><ShareBar pct={share} tone={tone} /></div>
      <p className="mt-2 text-xs text-muted-foreground tabular">{t("salesVsPurchases", { pct: f.number(Math.round(share)) })}</p>
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
    <section style={{ "--i": 2 } as CSSProperties} className={`${CARD} ${TINT} h-full`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{t("net")}</h3>
        <GoButton href="/reports/profit-loss" label={`${t("open")}: ${t("net")}`} />
      </div>
      {loading || net === undefined ? (
        <Skeleton className="mt-3 h-11 w-48 rounded-xl" />
      ) : (
        <div className={cn("mt-2 text-3xl leading-tight font-semibold sm:text-[2.5rem]", net < 0 && "text-danger")}><BigMoney value={net} /></div>
      )}
      <div className="mt-1 min-h-6">{net !== undefined && !loading ? <DeltaPill now={net} before={before?.net} good="up" /> : null}</div>
      {margin !== null && (
        <p className="mt-6 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground tabular">{t("ofSales", { pct: f.number(margin) })}</p>
      )}
    </section>
  );
}

export function KpiSummary({ now, before, loading }: { now?: Kpis; before?: Kpis; loading: boolean }) {
  const t = useTranslations("dashboard");
  const total = (now?.totalSales ?? 0) + (now?.totalPurchase ?? 0);
  const salesShare = total > 0 ? ((now?.totalSales ?? 0) / total) * 100 : 0;
  return (
    <section aria-label={t("salesPeriod")} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Headline order={0} label={t("totalSales")} value={now?.totalSales} before={before?.totalSales} good="up" share={salesShare} tone="ink" href="/sales" loading={loading} />
      <Headline order={1} label={t("totalPurchase")} value={now?.totalPurchase} before={before?.totalPurchase} share={total > 0 ? 100 - salesShare : 0} tone="accent" href="/purchases" loading={loading} />
      <div className="md:col-span-2 xl:col-span-1 [&>section]:h-full"><NetCard now={now} before={before} loading={loading} /></div>
    </section>
  );
}

/** Money going out and money owed, as one calm list under the headline cards. */
export function MoneyOut({ now, before, loading }: { now?: Kpis; before?: Kpis; loading: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const rows: { key: Key; label: string; warn?: boolean; href: string }[] = [
    { key: "invoiceDue", label: "invoiceDue", warn: true, href: "/sales" },
    { key: "purchaseDue", label: "purchaseDue", warn: true, href: "/purchases" },
    { key: "sellReturn", label: "totalSellReturn", href: "/sales/returns" },
    { key: "purchaseReturn", label: "totalPurchaseReturn", href: "/purchases/returns" },
  ];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <section style={{ "--i": 3 } as CSSProperties} className={CARD}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t("expense")}</h3>
          <GoButton href="/expenses" label={`${t("open")}: ${t("expense")}`} />
        </div>
        {loading || now?.expense === undefined ? <Skeleton className="mt-3 h-10 w-40 rounded-xl" /> : <div className="mt-2 text-3xl font-semibold"><BigMoney value={now.expense} /></div>}
        <div className="mt-1 min-h-6">{now?.expense !== undefined && !loading ? <DeltaPill now={now.expense} before={before?.expense} good="down" /> : null}</div>
      </section>
      <section style={{ "--i": 4 } as CSSProperties} className={CARD} aria-label={t("owedAndReturned")}>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t("owedAndReturned")}</h3>
        <ul className="divide-y divide-border/70">
          {rows.map((r) => {
            const v = now?.[r.key];
            return (
              <li key={r.key} className="flex items-center justify-between gap-3 py-3">
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
