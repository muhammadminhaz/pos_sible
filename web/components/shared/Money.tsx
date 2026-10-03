"use client";

import { cn } from "cn";
import { useFormat } from "@/lib/i18n/format";

export function Money({ value, className, muted }: { value: number; className?: string; muted?: boolean }) {
  const f = useFormat();
  return (
    <span className={cn("whitespace-nowrap tabular", value < 0 && "text-danger", muted && value === 0 && "text-muted-foreground", className)}>
      {f.money(value)}
    </span>
  );
}
