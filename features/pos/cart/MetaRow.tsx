"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";

const NONE = "none";

export function MetaRow({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.meta");
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { cart, update } = useCart(locationId);
  const technicians = lookups?.technicians ?? [];
  const layouts = lookups?.invoiceLayouts ?? [];
  const showLayout = settings?.pos.showInvoiceLayout;
  const showDate = settings?.pos.enableTransactionDate;
  if (!technicians.length && !showLayout && !showDate) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {technicians.length > 0 && (
        <Select value={cart.technicianId ?? NONE} onValueChange={(v) => update((c) => patchCart(c, { technicianId: v === NONE ? null : v }))}>
          <SelectTrigger size="sm" className="w-full" aria-label={t("technician")}>
            <SelectValue placeholder={t("technician")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{`${t("technician")}: ${t("none")}`}</SelectItem>
            {technicians.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showLayout && (
        <Select value={cart.invoiceLayoutId ?? NONE} onValueChange={(v) => update((c) => patchCart(c, { invoiceLayoutId: v === NONE ? null : v }))}>
          <SelectTrigger size="sm" className="w-full" aria-label={t("layout")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{`${t("layout")}: ${t("none")}`}</SelectItem>
            {layouts.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showDate && (
        <Input
          type="datetime-local"
          aria-label={t("date")}
          className="h-7 text-xs"
          value={cart.date ? format(new Date(cart.date), "yyyy-MM-dd'T'HH:mm") : ""}
          onChange={(e) => update((c) => patchCart(c, { date: e.target.value ? new Date(e.target.value).toISOString() : null }))}
        />
      )}
    </div>
  );
}
