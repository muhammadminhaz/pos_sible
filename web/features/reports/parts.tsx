"use client";

import type { ReactNode } from "react";
import { Money } from "@/components/shared/Money";
import { StatCard } from "@/components/shared/StatCard";
import type { Tone } from "@/components/shared/tones";

export function Stats({ items, cols = 4 }: { items: { label: string; value: number; tone?: Exclude<Tone, "primary"> }[]; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[cols];
  return (
    <div className={`grid gap-3 ${grid}`}>
      {items.map((i) => <StatCard key={i.label} label={i.label} tone={i.tone} value={<Money value={i.value} />} />)}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-spotlight className="reveal h-full rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
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
