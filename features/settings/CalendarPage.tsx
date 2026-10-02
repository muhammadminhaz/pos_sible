"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/PageHeader";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { calendarService } from "@/lib/data/services/calendar";
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
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [showBookings, setShowBookings] = useState(true);
  const { data } = useQuery({
    queryKey: ["calendar", cursor.y, cursor.m, locationId, showBookings],
    queryFn: () => calendarService.month({ year: cursor.y, month0: cursor.m, locationId, withBookings: showBookings }),
    placeholderData: keepPreviousData,
  });
  const bookingsOn = data?.bookingsOn ?? false;
  const events = useMemo(() => new Map(Object.entries(data?.days ?? {})), [data]);

  const first = new Date(cursor.y, cursor.m, 1);
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const cells = [...lead, ...Array(Math.ceil(lead.length / 7) * 7 - lead.length).fill(null)];
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
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>{weekdays.map((w) => <th key={w} scope="col" className="border-b bg-muted px-2 py-1.5 text-start text-xs font-medium text-muted-foreground">{w}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, w) => (
              <tr key={w}>
                {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
                  const e = d ? events.get(dayKey(cursor.y, cursor.m, d)) : undefined;
                  return (
                    <td key={i} className="h-20 border-e border-b bg-card p-1.5 align-top last:border-e-0">
                      {d && (
                        <>
                          <span className="text-xs text-muted-foreground">{f.number(d)}</span>
                          {e && e.sales > 0 && <p className="mt-1 truncate rounded bg-primary/10 px-1 text-xs text-primary">{t("salesCount", { count: e.sales })} · {f.money(e.total)}</p>}
                          {e && e.bookings > 0 && <p className="mt-1 truncate rounded bg-amber-500/15 px-1 text-xs text-amber-800 dark:text-amber-300">{t("bookingsCount", { count: e.bookings })}</p>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
