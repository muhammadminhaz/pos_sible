"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRightIcon, ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, MinusIcon, type LucideIcon } from "lucide-react";
import { CARD } from "@/components/shared/card-surface";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/lib/useCountUp";
import { formatMoney, STATE_LABEL, type Business } from "./api";

const STATE_STYLE = {
  active: "border-transparent bg-success-soft text-success-foreground",
  cancelled: "border-transparent bg-danger-soft text-danger-foreground",
  expired: "border-transparent bg-warning-soft text-warning-foreground",
} as const;

export function StateBadge({ state }: { state: Business["state"] }) {
  return <Badge variant="outline" className={STATE_STYLE[state]}>{STATE_LABEL[state]}</Badge>;
}

/** A number that counts up to its value; `format` turns the in-between numbers into text (money, sizes…). */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const shown = useCountUp(value);
  return <>{format(shown ?? value)}</>;
}

/** Money with the currency symbol small and muted, like the figures in the business app. */
function MoneyText({ value }: { value: number }) {
  const shown = useCountUp(value) ?? value;
  const m = /^(\D*?)(\d.*)$/.exec(formatMoney(shown));
  return m ? <><span className="mr-1 align-[0.55em] text-[0.45em] font-medium text-muted-foreground">{m[1]}</span>{m[2]}</> : <>{formatMoney(shown)}</>;
}

/** How a figure moved against the one before it: a green or red pill with an arrow. Nothing to compare gives no pill. */
export function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before) return <span className="block h-6" aria-hidden />;
  const pct = ((now - before) / before) * 100;
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const Icon = flat ? MinusIcon : up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold", flat ? "bg-muted text-muted-foreground" : up ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger-foreground")}>
        <Icon className="size-3.5" aria-hidden />
        <span className="tabular-nums">{`${up ? "+" : ""}${(Math.round(pct * 10) / 10).toLocaleString("en-US")}%`}</span>
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function StatCard({ label, value, count, money, format = (n) => String(Math.round(n)), hint, delta, loading }: { label: string; value?: ReactNode; count?: number; money?: boolean; format?: (n: number) => string; hint?: string; delta?: ReactNode; loading?: boolean }) {
  return (
    <div className={cn(CARD, "flex flex-col")}>
      {loading ? <Skeleton className="h-4 w-28 rounded-md" /> : <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>}
      {loading ? <Skeleton className="mt-3 h-9 w-36 max-w-full rounded-xl" /> : (
        <div className="mt-2 text-3xl leading-tight font-semibold tracking-tight tabular-nums">
          {count === undefined ? value : money ? <MoneyText value={count} /> : <CountUp value={count} format={format} />}
        </div>
      )}
      <div className="mt-1 min-h-6 text-xs text-muted-foreground">{loading ? <Skeleton className="mt-1 h-5 w-32 max-w-full rounded-full" /> : delta ?? hint}</div>
    </div>
  );
}

/** The figure a page is about: bigger than a stat card, for the hero of a page. */
export function BigMoney({ value }: { value: number }) {
  return <span className="tabular-nums tracking-tight"><MoneyText value={value} /></span>;
}

export function Panel({ title, description, children, className, action }: { title: string; description?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn(CARD, "h-full", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A labelled horizontal bar: `value` out of `max`. */
export function BarRow({ label, value, max, right }: { label: string; value: number; max: number; right: ReactNode }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{right}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className="grow-x h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Nothing here yet, said kindly: an icon, a line, and optionally what to do about it. */
export function Empty({ icon: Icon, children, action }: { icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {Icon && <span className="mb-3 grid size-11 place-items-center rounded-xl border bg-muted/50 text-muted-foreground"><Icon className="size-5" aria-hidden /></span>}
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50] as const;

/**
 * Splits a list into pages. `resetKey` is whatever narrows the list (the search text): when it changes the table goes
 * back to page 1 and stays there, even if the text later returns to an earlier value.
 */
export function usePaged<T>(rows: T[], resetKey: string) {
  const [state, setState] = useState({ page: 0, size: 10 as number, key: resetKey });
  // Adjusting state while rendering is React's way to reset state when a prop changes, with no extra render pass.
  if (state.key !== resetKey) setState({ page: 0, size: state.size, key: resetKey });
  const size = state.size;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(state.key === resetKey ? state.page : 0, pages - 1);
  return {
    rows: rows.slice(page * size, (page + 1) * size),
    page, pages, size, total: rows.length,
    setPage: (p: number) => setState({ page: Math.max(0, Math.min(p, pages - 1)), size, key: resetKey }),
    setSize: (n: number) => setState({ page: 0, size: n, key: resetKey }),
  };
}

/** Footer for a table: which rows are showing, rows per page, and first, previous, next, last. Hidden while one page is enough. */
export function Pager({ paged }: { paged: ReturnType<typeof usePaged> }) {
  const { page, pages, size, total } = paged;
  if (total <= PAGE_SIZES[0]) return null;
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px]">
      <span className="text-muted-foreground tabular-nums">Showing {from} to {to} of {total}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="hidden text-muted-foreground sm:inline">Rows per page</span>
          <Select value={String(size)} onValueChange={(v) => paged.setSize(Number(v))}>
            <SelectTrigger size="sm" className="w-20" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground tabular-nums">Page {page + 1} of {pages}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => paged.setPage(0)} aria-label="First page" className="hidden sm:inline-flex"><ChevronsLeftIcon /></Button>
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => paged.setPage(page - 1)} aria-label="Previous page"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => paged.setPage(page + 1)} aria-label="Next page"><ChevronRightIcon /></Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => paged.setPage(pages - 1)} aria-label="Last page" className="hidden sm:inline-flex"><ChevronsRightIcon /></Button>
        </div>
      </div>
    </nav>
  );
}
