import { service } from "@/lib/data/api/facade";
import { getDB } from "@/lib/data/store/db";
import { delay } from "./_util";

export type CalendarDay = { sales: number; total: number; bookings: number };
export type CalendarMonth = { days: Record<string, CalendarDay>; bookingsOn: boolean };

export const calendarService = service("calendarService", {
  /** Sales (and, if the module is on, bookings) per day for one month, at one location or all. `month0` is 0-based. */
  async month(q: { year: number; month0: number; locationId: string | "all"; withBookings: boolean }): Promise<CalendarMonth> {
    await delay();
    const d = getDB();
    const prefix = `${q.year}-${String(q.month0 + 1).padStart(2, "0")}`;
    const days: Record<string, CalendarDay> = {};
    const slot = (k: string) => (days[k] ??= { sales: 0, total: 0, bookings: 0 });
    for (const x of d.transactions) {
      if (x.type !== "sell" || x.status !== "final" || !x.date.startsWith(prefix) || (q.locationId !== "all" && x.locationId !== q.locationId)) continue;
      const e = slot(x.date.slice(0, 10));
      e.sales += 1;
      e.total += x.totals.total;
    }
    const bookingsOn = d.settings.modules.bookings;
    if (bookingsOn && q.withBookings) {
      for (const b of d.bookings) if (b.start.startsWith(prefix) && (q.locationId === "all" || b.locationId === q.locationId)) slot(b.start.slice(0, 10)).bookings += 1;
    }
    return { days, bookingsOn };
  },
});
