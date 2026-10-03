"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { bn as bnLocale } from "react-day-picker/locale";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSettings } from "@/lib/data/hooks/settings";
import { todayISO } from "@/lib/dates";
import { matchPreset, presetRange, RANGE_PRESETS, type DateRange } from "@/lib/domain/dateRanges";
import { useFormat } from "@/lib/i18n/format";

const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function useRangeContext() {
  const { data: settings } = useSettings();
  return { today: todayISO(settings?.business.timeZone), fyStartMonth: settings?.business.fyStartMonth ?? 7 };
}

export function useRangeLabel() {
  const t = useTranslations("dateRange");
  const f = useFormat();
  const { today, fyStartMonth } = useRangeContext();
  return (r: DateRange) => {
    const preset = matchPreset(r, today, fyStartMonth);
    if (preset) return t(preset);
    return r.from === r.to ? f.date(r.from) : `${f.date(r.from)} – ${f.date(r.to)}`;
  };
}

export function DateRangePicker({
  value,
  onChange,
  placeholder,
  className,
  align = "start",
  showDates,
}: {
  value?: DateRange;
  onChange: (r: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "end";
  /** Show the actual dates on the button even when the range matches a preset. */
  showDates?: boolean;
}) {
  const t = useTranslations("dateRange");
  const tc = useTranslations("common");
  const locale = useLocale();
  const label = useRangeLabel();
  const f = useFormat();
  const { today, fyStartMonth } = useRangeContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date } | undefined>();
  const active = value && matchPreset(value, today, fyStartMonth);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) setDraft(value ? { from: toDate(value.from), to: toDate(value.to) } : undefined);
  };

  const pick = (r: DateRange) => {
    onChange(r);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start font-normal", !value && "text-muted-foreground", className)}>
          <CalendarIcon />
          {value ? (showDates ? (value.from === value.to ? f.date(value.from) : `${f.date(value.from)} – ${f.date(value.to)}`) : label(value)) : (placeholder ?? t("pick"))}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="flex w-auto flex-col p-0 sm:flex-row">
        <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-44 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
          {RANGE_PRESETS.map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              className={cn("justify-start font-normal", active === p && "bg-primary/10 text-primary hover:bg-primary/10")}
              onClick={() => pick(presetRange(p, today, fyStartMonth))}
            >
              {t(p)}
            </Button>
          ))}
        </div>
        <div className="flex flex-col">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={draft?.from ?? toDate(today)}
            selected={draft?.from ? { from: draft.from, to: draft.to } : undefined}
            onSelect={(r) => setDraft(r ?? undefined)}
            locale={locale === "bn" ? bnLocale : undefined}
            className="p-3"
          />
          <div className="flex items-center justify-end gap-2 border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              {tc("clear")}
            </Button>
            <Button
              size="sm"
              disabled={!draft?.from}
              onClick={() => draft?.from && pick({ from: toISO(draft.from), to: toISO(draft.to ?? draft.from) })}
            >
              {tc("apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
