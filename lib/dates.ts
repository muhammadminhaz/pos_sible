/** Today's calendar date (YYYY-MM-DD) in the business time zone, not the browser's. */
export function todayISO(timeZone = "Asia/Dhaka", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
