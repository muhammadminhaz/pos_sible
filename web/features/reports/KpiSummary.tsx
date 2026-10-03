"use client";

import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/lib/useCountUp";
import type { Kpis } from "@/lib/data/services/dashboard";
import { useFormat } from "@/lib/i18n/format";

type Key = keyof Kpis;
/** `good` is the direction that is good news; omit it when neither direction is. */
const PRIMARY: { key: Key; label: string; good?: "up" | "down" }[] = [
  { key: "totalSales", label: "totalSales", good: "up" },
  { key: "net", label: "net", good: "up" },
  { key: "totalPurchase", label: "totalPurchase" },
  { key: "expense", label: "expense", good: "down" },
];
const SECONDARY: { key: Key; label: string; warn?: boolean }[] = [
  { key: "invoiceDue", label: "invoiceDue", warn: true },
  { key: "purchaseDue", label: "purchaseDue", warn: true },
  { key: "sellReturn", label: "totalSellReturn" },
  { key: "purchaseReturn", label: "totalPurchaseReturn" },
];

/** The headline figure, easing up to its value like the rest of the dashboard's numbers. */
function Figure({ value }: { value: number }) {
  const f = useFormat();
  const shown = useCountUp(value);
  return <>{f.money(shown ?? value)}</>;
}

function Delta({ now, before, good }: { now: number; before?: number; good?: "up" | "down" }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  if (before === undefined || before === 0) return <span className="mt-1.5 block h-4" aria-hidden />;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const tone = flat || !good ? "text-muted-foreground" : (up ? "up" : "down") === good ? "text-success-foreground dark:text-success" : "text-danger-foreground dark:text-danger";
  const Icon = flat ? MinusIcon : up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className="mt-1.5 flex items-center gap-1.5 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-medium", tone)}>
        <Icon className="size-3.5" aria-hidden />
        <span className="tabular">{`${up ? "+" : ""}${f.number(Math.round(pct * 10) / 10)}%`}</span>
      </span>
      <span className="text-muted-foreground">{t("vsPrevious")}</span>
    </span>
  );
}

/** One hairline-divided surface: headline figures with their change on top, dues and returns underneath. */
export function KpiSummary({ now, before, loading }: { now?: Kpis; before?: Kpis; loading: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  return (
    <section aria-label={t("salesPeriod")} className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {PRIMARY.map((k) => {
        const v = now?.[k.key];
        return (
          <div key={k.key} data-spotlight className="bg-card p-5">
            <div className="text-[13px] font-medium text-muted-foreground">{t(k.label)}</div>
            {loading || v === undefined ? (
              <Skeleton className="mt-3 h-9 w-36" />
            ) : (
              <div className={cn("mt-2 text-3xl font-semibold tracking-tight tabular", v < 0 && "text-danger")}><Figure value={v} /></div>
            )}
            {v !== undefined && !loading ? <Delta now={v} before={before?.[k.key]} good={k.good} /> : <span className="mt-1.5 block h-4" aria-hidden />}
          </div>
        );
      })}
      {SECONDARY.map((k) => {
        const v = now?.[k.key];
        return (
          <div key={k.key} className="bg-secondary px-5 py-4">
            <div className="text-[13px] text-muted-foreground">{t(k.label)}</div>
            {loading || v === undefined ? (
              <Skeleton className="mt-2 h-6 w-28" />
            ) : (
              <div className={cn("mt-1 text-xl font-semibold tabular", k.warn && v > 0 ? "text-warning-foreground dark:text-warning" : v === 0 && "text-muted-foreground")}>
                {f.money(v)}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
