"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  "h-8 gap-1.5 rounded-lg border-dashed px-2.5 text-[13px] font-normal data-[active=true]:border-solid data-[active=true]:border-primary/30 data-[active=true]:bg-primary/5";

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
  const [open, setOpen] = useState(false);
  const multi = def.type === "multiselect";
  const selected = value ? (multi ? value.split(",") : [value]) : [];
  const labels = selected.map((v) => def.options?.find((o) => o.value === v)?.label ?? v);

  const toggle = (v: string) => {
    if (!multi) {
      onChange(selected[0] === v ? undefined : v);
      setOpen(false);
      return;
    }
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next.length ? next.join(",") : undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={chip} data-active={selected.length > 0}>
          {selected.length === 0 && <PlusCircleIcon className="text-muted-foreground" />}
          <span className={cn(selected.length > 0 && "text-muted-foreground")}>{def.label}</span>
          {selected.length > 0 && (
            <>
              <span className="h-3.5 w-px bg-border" />
              <span className="max-w-40 truncate font-medium">
                {labels.length > 2 ? t("selected", { count: labels.length }) : labels.join(", ")}
              </span>
              <ClearX onClear={() => onChange(undefined)} label={t("clear")} />
            </>
          )}
          {selected.length === 0 && <ChevronDownIcon className="text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          {(def.options?.length ?? 0) > 7 && <CommandInput placeholder={def.label} />}
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            <CommandGroup>
              {def.options?.map((o) => {
                const isOn = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                    {multi ? (
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded-[4px] border",
                          isOn && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {isOn && <CheckIcon className="size-3 text-primary-foreground!" />}
                      </span>
                    ) : null}
                    <span className="flex-1 truncate">{o.label}</span>
                    {!multi && isOn && <CheckIcon className="size-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  className,
}: {
  defs: FilterDef[];
  value: FilterValue;
  onChange: (patch: FilterValue) => void;
  onReset: () => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const anyActive = defs.some((d) => value[d.key]);

  return (
    <div data-print-hide className={cn("flex flex-wrap items-center gap-2", className)}>
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
  );
}
