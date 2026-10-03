"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/lib/useCountUp";
import { STATE_LABEL, type Business } from "./api";

const STATE_STYLE = {
  active: "border-transparent bg-success-soft text-success-foreground",
  suspended: "border-transparent bg-danger-soft text-danger-foreground",
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

export function StatCard({ label, value, count, format = (n) => String(Math.round(n)), hint, loading }: { label: string; value?: ReactNode; count?: number; format?: (n: number) => string; hint?: string; loading?: boolean }) {
  return (
    <Card size="sm" data-spotlight className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="grid gap-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-semibold tabular-nums">{count !== undefined ? <CountUp value={count} format={format} /> : value}</div>}
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function Panel({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card data-spotlight className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className="grow-x h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
