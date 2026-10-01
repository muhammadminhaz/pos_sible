"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor?: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`grid content-start gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PickField({ label, value, options, onChange, nullable = true, className }: {
  label: string; value: string | null; options: { value: string; label: string }[]; onChange: (v: string | null) => void; nullable?: boolean; className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value ?? NONE} onValueChange={(x) => onChange(x === NONE ? null : x)}>
        <SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {nullable && <SelectItem value={NONE}>—</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A number box that reports `0` when emptied and `null` only when `nullable`. */
export function NumInput({ label, value, onChange, min = 0, nullable, className }: {
  label: string; value: number | null; onChange: (v: number) => void; min?: number; nullable?: false; className?: string;
} | {
  label: string; value: number | null; onChange: (v: number | null) => void; min?: number; nullable: true; className?: string;
}) {
  return (
    <Input
      aria-label={label} type="number" step="any" min={min} className={`tabular-nums ${className ?? ""}`} value={value == null ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (nullable) (onChange as (v: number | null) => void)(raw === "" ? null : Number(raw));
        else (onChange as (v: number) => void)(raw === "" ? 0 : Number(raw));
      }}
    />
  );
}
