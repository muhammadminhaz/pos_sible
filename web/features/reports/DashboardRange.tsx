"use client";

import { useTranslations } from "next-intl";
import { DateRangePicker, useRangeContext } from "@/components/shared/DateRangePicker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { matchPreset, presetRange, type DateRange, type RangePreset } from "@/lib/domain/dateRanges";

const QUICK: { preset: RangePreset; label: "thisMonth" | "short3" | "short6" | "short12"; full: string }[] = [
  { preset: "thisMonth", label: "thisMonth", full: "thisMonth" },
  { preset: "last3Months", label: "short3", full: "last3Months" },
  { preset: "last6Months", label: "short6", full: "last6Months" },
  { preset: "last12Months", label: "short12", full: "last12Months" },
];

/** Quick ranges plus a custom picker; the picker button always shows the dates being reported on. */
export function DashboardRange({ value, onChange }: { value: DateRange; onChange: (r: DateRange | undefined) => void }) {
  const t = useTranslations("dashboard");
  const tr = useTranslations("dateRange");
  const { today, fyStartMonth } = useRangeContext();
  const active = matchPreset(value, today, fyStartMonth);
  const selected = QUICK.find((q) => q.preset === active)?.preset ?? "";

  return (
    <div data-print-hide className="flex max-w-full flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={selected}
        onValueChange={(v) => v && onChange(presetRange(v as RangePreset, today, fyStartMonth))}
        aria-label={tr("quick")}
        className="max-w-full overflow-x-auto"
      >
        {QUICK.map((q) => (
          <ToggleGroupItem
            key={q.preset}
            value={q.preset}
            aria-label={tr(q.full)}
            className="px-3 text-[13px] pointer-coarse:h-11 data-[state=on]:bg-muted data-[state=on]:font-semibold data-[state=on]:text-foreground"
          >
            {q.label === "thisMonth" ? tr("thisMonth") : t(q.label)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <DateRangePicker value={value} onChange={onChange} align="end" showDates />
    </div>
  );
}
