"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDB } from "@/lib/data/store/db";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month view: sales per day for the chosen location, plus bookings when that module is on. */
export function CalendarPage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const f = useFormat();
  const locationId = useUI((s) => s.locationId);
  const txns = useDB((s) => s.db?.transactions);
  const bookings = useDB((s) => s.db?.bookings);
  const bookingsOn = useDB((s) => s.db?.settings.modules.bookings) ?? false;
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [showBookings, setShowBookings] = useState(true);

  const events = useMemo(() => {
    const out = new Map<string, { sales: number; total: number; bookings: number }>();
    const slot = (k: string) => out.get(k) ?? out.set(k, { sales: 0, total: 0, bookings: 0 }).get(k)!;
    for (const x of txns ?? []) {
      if (x.type !== "sell" || x.status !== "final" || (locationId !== "all" && x.locationId !== locationId)) continue;
      const e = slot(x.date.slice(0, 10));
      e.sales += 1;
      e.total += x.totals.total;
    }
    if (bookingsOn && showBookings)
      for (const b of bookings ?? []) if (locationId === "all" || b.locationId === locationId) slot(b.start.slice(0, 10)).bookings += 1;
    return out;
  }, [txns, bookings, locationId, bookingsOn, showBookings]);

  const first = new Date(cursor.y, cursor.m, 1);
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (by: number) => setCursor(({ y, m }) => { const d = new Date(y, m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 7 + i)));

  return (
    <>
      <PageHeader
        title={new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first)}
        description={t("calendarDescription")}
        actions={
          <>
            {bookingsOn && (
              <div className="flex items-center gap-2">
                <Switch id="cal-bookings" checked={showBookings} onCheckedChange={setShowBookings} />
                <Label htmlFor="cal-bookings">{t("showBookings")}</Label>
              </div>
            )}
            <Button variant="outline" size="icon" aria-label={t("prevMonth")} onClick={() => shift(-1)}><ChevronLeftIcon /></Button>
            <Button variant="outline" size="icon" aria-label={t("nextMonth")} onClick={() => shift(1)}><ChevronRightIcon /></Button>
          </>
        }
      />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-sm" role="grid">
        {weekdays.map((w) => <div key={w} role="columnheader" className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">{w}</div>)}
        {cells.map((d, i) => {
          const e = d ? events.get(dayKey(cursor.y, cursor.m, d)) : undefined;
          return (
            <div key={i} role="gridcell" className="min-h-20 bg-card p-1.5">
              {d && (
                <>
                  <span className="text-xs text-muted-foreground">{f.number(d)}</span>
                  {e && e.sales > 0 && <p className="mt-1 truncate rounded bg-primary/10 px-1 text-xs text-primary">{t("salesCount", { count: e.sales })} · {f.money(e.total)}</p>}
                  {e && e.bookings > 0 && <p className="mt-1 truncate rounded bg-amber-500/15 px-1 text-xs text-amber-700 dark:text-amber-300">{t("bookingsCount", { count: e.bookings })}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
