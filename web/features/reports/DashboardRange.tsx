"use client";

import { useTranslations } from "next-intl";
import { DateRangePicker, useRangeContext } from "@/components/shared/DateRangePicker";
import RubberSegment from "@/components/ui/rubber-segment";
import { matchPreset, presetRange, type DateRange, type RangePreset } from "@/lib/domain/dateRanges";

const QUICK: { preset: RangePreset; label: "thisMonth" | "short3" | "short6" | "short12"; full: string }[] = [
  { preset: "thisMonth", label: "thisMonth", full: "thisMonth" },
  { preset: "last3Months", label: "short3", full: "last3Months" },
  { preset: "last6Months", label: "short6", full: "last6Months" },
  { preset: "last12Months", label: "short12", full: "last12Months" },
];

/** Quick ranges plus a custom picker; the picker button always shows the dates being reported on. */
export function DashboardRange({ value, onChange, allFrom }: { value?: DateRange; onChange: (r: DateRange | undefined) => void; allFrom?: string | null }) {
  const t = useTranslations("dashboard");
  const tr = useTranslations("dateRange");
  const { today, fyStartMonth } = useRangeContext();
  const active = value && matchPreset(value, today, fyStartMonth);
  const isAll = !!allFrom && value?.from === allFrom && value?.to === today;
  const selected = isAll ? "all" : (QUICK.find((q) => q.preset === active)?.preset ?? "");

  return (
    <div data-print-hide className="flex max-w-full flex-wrap items-center gap-2">
      <RubberSegment
        aria-label={tr("quick")}
        items={[
          ...QUICK.map((q) => ({ value: q.preset as string, label: q.label === "thisMonth" ? tr("thisMonth") : t(q.label) })),
          ...(allFrom ? [{ value: "all", label: tr("all") }] : []),
        ]}
        value={selected}
        onChange={(v) => onChange(v === "all" && allFrom ? { from: allFrom, to: today } : presetRange(v as RangePreset, today, fyStartMonth))}
        trackColor="var(--muted)"
        thumbColor="var(--foreground)"
        textColor="var(--foreground)"
        activeTextColor="var(--background)"
        radius={999}
        inset={3}
        size="md"
      />
      <DateRangePicker value={value} onChange={onChange} align="end" showDates className="min-w-56" />
    </div>
  );
}
