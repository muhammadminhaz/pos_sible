"use client";

import type { ReactNode } from "react";
import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PickField } from "@/features/catalog/formParts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { useUI } from "@/lib/data/store/ui";
import { todayISO } from "@/lib/dates";

/** Location + as-of date for a ledger report; the location starts at the header's switcher. */
export function useReportScope() {
  const { data: settings } = useSettings();
  const globalLocation = useUI((s) => s.locationId);
  return { today: todayISO(settings?.business.timeZone), defaultLocation: globalLocation === "all" ? null : globalLocation };
}

export function ReportControls({ locationId, onLocation, children }: { locationId: string | null; onLocation: (id: string | null) => void; children?: ReactNode }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  return (
    <div data-print-hide className="mb-4 flex flex-wrap items-end gap-4">
      <PickField label={t("common.location")} value={locationId} onChange={onLocation} className="w-56" options={(lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} />
      {children}
      <Button variant="outline" className="ml-auto" onClick={() => window.print()}><PrinterIcon />{t("common.print")}</Button>
    </div>
  );
}

export function DateField({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) {
  return <Field label={label} htmlFor={id}><Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-44" /></Field>;
}
