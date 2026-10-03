"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRightIcon, ClockIcon, HandCoinsIcon, HeartHandshakeIcon, PackagePlusIcon, RefreshCwIcon, SparklesIcon, TagIcon, TrendingUpIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { CARD } from "@/components/shared/card-surface";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReport } from "@/lib/data/hooks/reports";
import { possibleReports, type Opportunity } from "@/lib/data/services/reports/possible";
import { useFormat } from "@/lib/i18n/format";
import { ForecastChart } from "@/features/analytics/charts";
import { BigMoney, DeltaPill } from "@/features/reports/KpiSummary";

const ICON: Record<Opportunity["kind"], LucideIcon> = {
  restock: PackagePlusIcon, winBack: HeartHandshakeIcon, collect: HandCoinsIcon, clearStock: TagIcon, price: TrendingUpIcon, peak: ClockIcon,
};
const HREF: Record<Opportunity["kind"], string> = {
  restock: "/purchases/new", winBack: "/contacts/customers", collect: "/reports/contacts", clearStock: "/sales/discounts", price: "/products/update-price", peak: "/analytics/sales",
};

function Retry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <EmptyState icon={TriangleAlertIcon} title={t("possible.errorTitle")} description={t("possible.errorHint")}
      action={<Button variant="outline" className="rounded-full" onClick={onRetry}><RefreshCwIcon aria-hidden />{t("common.tryAgain")}</Button>} />
  );
}

function ForecastCard() {
  const t = useTranslations("possible");
  const f = useFormat();
  const q = useReport("possible-forecast", {}, () => possibleReports.forecast());
  const fc = q.data;
  if (q.isError && !fc) return <div className={CARD}><Retry onRetry={() => q.refetch()} /></div>;
  return (
    <section className={cn(CARD, "grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center")} aria-label={t("forecastLabel")}>
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-muted-foreground">{t("forecastLabel")}</h2>
        {!fc ? (
          <>
            <Skeleton className="mt-3 h-11 w-56 max-w-full rounded-xl" />
            <Skeleton className="mt-3 h-6 w-36 rounded-full" />
            <Skeleton className="mt-5 h-4 w-60 max-w-full rounded-md" />
          </>
        ) : (
          <>
            <div className="mt-2 text-4xl leading-tight font-semibold sm:text-5xl"><BigMoney value={fc.projected} /></div>
            <div className="mt-2"><DeltaPill now={fc.projected} before={fc.lastMonth} good="up" /></div>
            <p className="mt-5 text-sm">{t("soFar", { amount: f.money(fc.mtd), days: fc.daysLeft })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("lastMonth", { amount: f.money(fc.lastMonth) })}</p>
            <p className="mt-4 max-w-sm text-xs text-muted-foreground">{t("forecastHow")}</p>
          </>
        )}
      </div>
      <div className="min-w-0">
        {!fc ? <Skeleton className="h-60 w-full rounded-2xl" /> : (
          <ForecastChart data={fc.series} xKey="day" actual={{ key: "actual", label: t("actual") }} projected={{ key: "projected", label: t("projected") }} label={t("forecastChart")} />
        )}
      </div>
    </section>
  );
}

/** The sentence and amount for one opportunity, in the reader's language. */
function useCopy() {
  const t = useTranslations("possible");
  const f = useFormat();
  const locale = useLocale();
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00`));
  const list = (names: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(names.filter(Boolean));
  return (o: Opportunity): { title: string; body: string; chip?: string } => {
    const amount = f.money(o.impact);
    switch (o.kind) {
      case "restock": return { title: t("op.restock.title", { product: o.product, date: day(o.by) }), body: t("op.restock.body", { days: o.daysLeft, qty: f.number(o.suggest), amount }), chip: t("possibleAmount", { amount }) };
      case "winBack": return { title: t("op.winBack.title", { count: o.count }), body: t("op.winBack.body", { names: list(o.names), days: o.days, amount }), chip: t("possibleAmount", { amount }) };
      case "collect": return { title: t("op.collect.title", { amount }), body: t("op.collect.body", { count: o.count, names: list(o.names) }), chip: t("toCollect", { amount }) };
      case "clearStock": return { title: t("op.clearStock.title", { amount }), body: t("op.clearStock.body", { count: o.count, days: o.days, top: o.top }), chip: t("freeUp", { amount }) };
      case "price": return { title: t("op.price.title", { product: o.product, raise: o.raise }), body: t("op.price.body", { margin: f.number(Math.round(o.margin)), raise: o.raise, amount }), chip: t("possibleAmount", { amount }) };
      case "peak": {
        // 2026-01-04 is a Sunday, so day 0 lines up with the weekday index.
        const at = new Date(2026, 0, 4 + o.weekday, o.hour);
        return {
          title: t("op.peak.title", { weekday: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(at), hour: new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(at) }),
          body: t("op.peak.body"),
        };
      }
    }
  };
}

function OpportunityCard({ o, featured }: { o: Opportunity; featured?: boolean }) {
  const t = useTranslations("possible");
  const copy = useCopy()(o);
  const Icon = ICON[o.kind];
  return (
    <article className={cn(
      "reveal group flex min-w-0 flex-col rounded-3xl p-5 sm:p-6",
      // The lead opportunity is the one place the accent fills a surface, so it reads as "start here".
      featured ? "bg-primary text-primary-foreground shadow-[0_18px_40px_-22px_var(--primary)] md:col-span-2" : cn(CARD, "bg-none bg-card"),
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn("grid size-10 place-items-center rounded-2xl", featured ? "bg-primary-foreground/15" : "bg-primary/10 text-primary")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold tabular", featured ? "bg-primary-foreground/15" : copy.chip ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          {copy.chip ?? t("tip")}
        </span>
      </div>
      <h3 className={cn("mt-4 font-semibold tracking-tight text-balance", featured ? "text-xl sm:text-2xl" : "text-lg")}>{copy.title}</h3>
      <p className={cn("mt-2 max-w-prose text-sm text-pretty", featured ? "text-primary-foreground/80" : "text-muted-foreground")}>{copy.body}</p>
      <div className="mt-auto pt-5">
        <Button asChild size="sm" variant={featured ? "secondary" : "outline"} className="rounded-full">
          <Link href={HREF[o.kind]}>
            {t(`op.${o.kind}.action`)}
            <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function NextMoves() {
  const t = useTranslations("possible");
  const f = useFormat();
  const q = useReport("possible-opportunities", {}, () => possibleReports.opportunities());
  const ops = q.data;
  const total = (ops ?? []).reduce((s, o) => s + o.impact, 0);
  const counted = (ops ?? []).filter((o) => o.impact > 0).length;
  return (
    <section className="mt-10" aria-labelledby="next-moves">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="next-moves" className="text-lg font-semibold tracking-tight">{t("nextMoves")}</h2>
        {ops && counted > 0 && <p className="text-sm text-muted-foreground">{t("totalPossible", { amount: f.money(total), count: counted })}</p>}
      </div>
      {q.isError && !ops ? (
        <div className={CARD}><Retry onRetry={() => q.refetch()} /></div>
      ) : !ops ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy>
          <Skeleton className="h-56 rounded-3xl md:col-span-2" />
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-52 rounded-3xl" />
        </div>
      ) : !ops.length ? (
        <div className={CARD}>
          <EmptyState icon={SparklesIcon} title={t("noneTitle")} description={t("noneHint")}
            action={<Button asChild className="rounded-full"><Link href="/goals">{t("setGoal")}<ArrowRightIcon aria-hidden /></Link></Button>} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ops.map((o, i) => <OpportunityCard key={o.id} o={o} featured={i === 0 && o.impact > 0} />)}
        </div>
      )}
    </section>
  );
}

export function Opportunities() {
  const t = useTranslations("possible");
  return (
    <>
      <PageHeader title={t("opportunitiesTitle")} description={t("opportunitiesDescription")} />
      <ForecastCard />
      <NextMoves />
    </>
  );
}
