"use client";

import { useId, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, MapPinIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import GlideSelect from "@/components/ui/glide-select";
import { DateRangePicker, useRangeLabel } from "../DateRangePicker";
import { decodeRange, encodeRange } from "./useUrlFilters";

export type FilterOption = { value: string; label: string };
export type FilterDef = {
  key: string;
  label: string;
  type: "select" | "multiselect" | "daterange" | "toggle";
  options?: FilterOption[];
};
export type FilterValue = Record<string, string | undefined>;

const chip =
  "h-8 gap-1.5 rounded-lg bg-muted/50 px-2.5 text-[13px] font-normal hover:bg-muted data-[active=true]:border-primary/30 data-[active=true]:bg-primary/5";

function ClearX({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClear();
        }
      }}
      className="-mr-1 ml-0.5 grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <XIcon className="size-3" />
    </span>
  );
}

function OptionsChip({ def, value, onChange }: { def: FilterDef; value?: string; onChange: (v?: string) => void }) {
  const t = useTranslations("common");
  const multi = true; // every dropdown filter takes several values; the URL holds them comma-separated
  const selected = value ? (multi ? value.split(",") : [value]) : [];
  const options = def.options ?? [];

  return (
    <span className="inline-flex items-center gap-1">
      <GlideSelect
        field
        className="gs-filter-chip"
        searchable={options.length > 7}
        searchPlaceholder={def.label}
        emptyText={t("noResults")}
        ariaLabel={def.label}
        placeholder={def.label}
        icon={def.key === "location" || def.key === "locationId" ? <MapPinIcon size={14} /> : undefined}
        menuWidth={240}
        options={options}
        {...(multi
          ? { multiple: true, values: selected, onValuesChange: (v: string[]) => onChange(v.length ? v.join(",") : undefined), summary: (count: number) => t("selected", { count }) }
          : { value: selected[0], onChange: (v: string) => onChange(v === selected[0] ? undefined : v) })}
      />
      {selected.length > 0 && <ClearX onClear={() => onChange(undefined)} label={t("clear")} />}
    </span>
  );
}

function RangeChip({ def, value, onChange }: { def: FilterDef; value?: string; onChange: (v?: string) => void }) {
  const t = useTranslations("common");
  const range = decodeRange(value);
  const label = useRangeLabel();
  if (!range) {
    return (
      <DateRangePicker
        value={undefined}
        onChange={(r) => onChange(encodeRange(r))}
        placeholder={def.label}
        className={cn(chip, "text-foreground")}
      />
    );
  }
  return (
    <div className="inline-flex items-center">
      <DateRangePicker
        value={range}
        onChange={(r) => onChange(encodeRange(r))}
        className={cn(chip, "border-solid border-primary/30 bg-primary/5 pr-7 text-foreground")}
      />
      <span className="-ml-6">
        <ClearX onClear={() => onChange(undefined)} label={`${t("clear")} ${label(range)}`} />
      </span>
    </div>
  );
}

function ToggleChip({ def, value, onChange }: { def: FilterDef; value?: string; onChange: (v?: string) => void }) {
  const on = value === "1";
  return (
    <Button variant="outline" size="sm" className={chip} data-active={on} aria-pressed={on} onClick={() => onChange(on ? undefined : "1")}>
      <span
        className={cn(
          "grid size-3.5 place-items-center rounded-[4px] border",
          on && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {on && <CheckIcon className="size-2.5" />}
      </span>
      {def.label}
    </Button>
  );
}

export function FilterBar({
  defs,
  value,
  onChange,
  onReset,
  mobileActions,
  className,
}: {
  defs: FilterDef[];
  value: FilterValue;
  onChange: (patch: FilterValue) => void;
  onReset: () => void;
  /** Shown right-aligned on the same row as the mobile Filters toggle. */
  mobileActions?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const activeCount = defs.filter((d) => value[d.key]).length;
  const anyActive = activeCount > 0;

  // Below md the chips fold behind one button so they don't push the table off screen.
  return (
    <div data-print-hide className={cn("flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center", className)}>
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontalIcon />
          {t("filters")}
          {anyActive && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular">{activeCount}</span>}
          <ChevronDownIcon className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
        </Button>
        {mobileActions}
      </div>
      <div id={panelId} className={cn("flex-wrap items-center gap-2 md:flex", open ? "flex" : "hidden")}>
        {defs.map((d) => {
          const set = (v?: string) => onChange({ [d.key]: v });
          if (d.type === "daterange") return <RangeChip key={d.key} def={d} value={value[d.key]} onChange={set} />;
          if (d.type === "toggle") return <ToggleChip key={d.key} def={d} value={value[d.key]} onChange={set} />;
          return <OptionsChip key={d.key} def={d} value={value[d.key]} onChange={set} />;
        })}
        {anyActive && (
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onReset}>
            {t("reset")}
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
