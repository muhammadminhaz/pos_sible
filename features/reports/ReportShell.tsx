"use client";

import type { ReactNode } from "react";
import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRangeContext } from "@/components/shared/DateRangePicker";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange, encodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { PageHeader } from "@/components/shared/PageHeader";
import { useLookups } from "@/lib/data/hooks/lookups";
import type { ReportFilter } from "@/lib/data/services/reports/_shared";
import { useUI } from "@/lib/data/store/ui";
import { presetRange } from "@/lib/domain/dateRanges";
import { PrintPortal, useReportPrint } from "./print";

type Url = Record<string, string | undefined>;

/**
 * Filter state shared by every report: `location` and `range` in the URL, defaulting to the header's location and this month.
 * `extraKeys` are the report's own filters (category, brand…); they come back in `url`.
 */
export function useReportFilters<K extends string = never>(extraKeys: readonly K[] = [], opts: { defaultRange?: boolean } = {}) {
  const globalLocation = useUI((s) => s.locationId);
  const { today, fyStartMonth } = useRangeContext();
  const [url, setUrl, resetUrl] = useUrlFilters<Url>(["location", "range", ...extraKeys]);
  const fallback = opts.defaultRange === false ? undefined : presetRange("thisMonth", today, fyStartMonth);
  const range = decodeRange(url.range) ?? fallback;
  const filter: ReportFilter = { from: range?.from, to: range?.to, locationId: url.location ?? (globalLocation === "all" ? null : globalLocation) };
  /** What the filter bar shows, so the default range is visible and not just applied. */
  const shown: Url = { ...url, range: url.range ?? encodeRange(fallback) };
  return { filter, url: url as Url & Partial<Record<K, string>>, shown, setUrl, resetUrl };
}
export type ReportFilters = ReturnType<typeof useReportFilters>;

export function ReportShell({
  title, description, rf, extraDefs = [], noDate, noLocation, actions, children,
}: {
  title: string; description?: string; rf: ReportFilters; extraDefs?: FilterDef[]; noDate?: boolean; noLocation?: boolean; actions?: ReactNode; children: ReactNode;
}) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { printing, print } = useReportPrint();
  const defs: FilterDef[] = [
    ...(noLocation ? [] : [{ key: "location", label: t("common.location"), type: "select" as const, options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) }]),
    ...extraDefs,
    ...(noDate ? [] : [{ key: "range", label: t("sales.dateRange"), type: "daterange" as const }]),
  ];
  const scope = [lookups?.locations.find((l) => l.id === rf.filter.locationId)?.name ?? t("common.allLocations"), rf.filter.from && rf.filter.to ? `${rf.filter.from} → ${rf.filter.to}` : ""].filter(Boolean).join(" · ");
  return (
    <>
      <PageHeader
        title={title} description={description}
        actions={<>{actions}<Button variant="outline" onClick={print}><PrinterIcon />{t("common.print")}</Button></>}
      />
      <div className="mb-4"><FilterBar defs={defs} value={rf.shown} onChange={(p) => rf.setUrl(p)} onReset={rf.resetUrl} /></div>
      <div className="grid gap-4">{children}</div>
      <PrintPortal printing={printing}>
        <h1 className="mb-1 text-lg font-semibold">{title}</h1>
        <p className="mb-4 text-neutral-600">{scope}</p>
        <div className="grid gap-4">{children}</div>
      </PrintPortal>
    </>
  );
}
