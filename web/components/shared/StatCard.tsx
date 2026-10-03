import type { ReactNode } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { TONE_SOFT, type Tone } from "./tones";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  tone = "default",
  loading,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  delta?: { value: number; positive?: boolean };
  hint?: ReactNode;
  tone?: Exclude<Tone, "primary">;
  loading?: boolean;
}) {
  const positive = delta && (delta.positive ?? delta.value >= 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon &&
          (tone === "default" ? (
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          ) : (
            <span className={cn("grid size-8 place-items-center rounded-lg", TONE_SOFT[tone])}>
              <Icon className="size-4" />
            </span>
          ))}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <div className="text-2xl font-semibold tracking-tight tabular">{value}</div>
      )}
      {(delta || hint) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-success" : "text-danger")}>
              {positive ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
              <span className="tabular">{Math.abs(delta.value).toFixed(1)}%</span>
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  );
}
