"use client";

import type { ReactNode } from "react";
import { Money } from "@/components/shared/Money";
import type { CSSProperties } from "react";
import { cn } from "cn";
import { CARD } from "@/components/shared/card-surface";
import type { Tone } from "@/components/shared/tones";
import { BigMoney } from "./KpiSummary";

export function Stats({ items, cols = 4 }: { items: { label: string; value: number; tone?: Exclude<Tone, "primary"> }[]; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[cols];
  return (
    <div className={`grid gap-3 ${grid}`}>
      {items.map((i, n) => (
        <section key={i.label} style={{ "--i": n } as CSSProperties} className={cn(CARD, "h-full")}>
          <h3 className="text-sm font-medium text-muted-foreground">{i.label}</h3>
          <div className={cn("mt-2 text-3xl leading-tight font-semibold", i.value < 0 && "text-danger")}><BigMoney value={i.value} /></div>
        </section>
      ))}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(CARD, "h-full")}>
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Lines({ rows }: { rows: { label: string; value: number; strong?: boolean; plain?: boolean }[] }) {
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className={`flex justify-between gap-4 ${r.strong ? "border-t pt-2 text-base font-semibold" : ""}`}><dt className={r.strong ? "" : "text-muted-foreground"}>{r.label}</dt><dd>{r.plain ? <span className="tabular">{r.value}</span> : <Money value={r.value} />}</dd></div>
      ))}
    </dl>
  );
}
