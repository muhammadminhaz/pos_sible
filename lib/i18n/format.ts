"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import type { Settings } from "@/lib/data/schemas";
import { useSettings } from "@/lib/data/hooks/settings";

type FormatOptions = {
  symbol: string;
  placement: "before" | "after";
  precision: number;
  qtyPrecision: number;
  dateFormat: Settings["business"]["dateFormat"];
  timeFormat: "12" | "24";
  timeZone: string;
};

const DEFAULTS: FormatOptions = {
  symbol: "৳",
  placement: "before",
  precision: 2,
  qtyPrecision: 2,
  dateFormat: "dd-mm-yyyy",
  timeFormat: "12",
  timeZone: "Asia/Dhaka",
};

const BN_UNITS: Record<string, string> = {
  "pc(s)": "পিস", pcs: "পিস", pieces: "পিস", kg: "কেজি", kilogram: "কেজি", g: "গ্রাম", gram: "গ্রাম", ltr: "লিটার", l: "লিটার", liter: "লিটার", litre: "লিটার",
  bag: "বস্তা", box: "বাক্স", pack: "প্যাক", dram: "ড্রাম", set: "সেট", dozen: "ডজন", m: "মিটার", meter: "মিটার",
};

export type Formatter = ReturnType<typeof createFormatter>;

/** Pure formatter so non-React code (exports, print) formats exactly like the UI. */
export function createFormatter(locale: string, opts: Partial<FormatOptions> = {}) {
  const o = { ...DEFAULTS, ...opts };
  const tag = locale === "bn" ? "bn-BD" : "en-US";
  const fixed = (digits: number) =>
    new Intl.NumberFormat(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const moneyFmt = fixed(o.precision);
  const intFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const qtyFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: o.qtyPrecision });
  const pctFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const compactFmt = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  const digitFmt = new Intl.NumberFormat(tag, { useGrouping: false, minimumIntegerDigits: 2 });
  const yearFmt = new Intl.NumberFormat(tag, { useGrouping: false });
  const partsFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: o.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const longFmt = new Intl.DateTimeFormat(tag, { timeZone: o.timeZone, day: "numeric", month: "short", year: "numeric" });

  const toDate = (d: string | Date) => (typeof d === "string" ? new Date(d) : d);
  const parts = (d: string | Date) => {
    const p = Object.fromEntries(partsFmt.formatToParts(toDate(d)).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
  };

  const money = (n: number) => {
    const body = moneyFmt.format(Math.abs(n));
    const signed = o.placement === "before" ? `${o.symbol}${body}` : `${body} ${o.symbol}`;
    return n < 0 ? `-${signed}` : signed;
  };

  const date = (d: string | Date) => {
    const { y, m, d: day } = parts(d);
    const dd = digitFmt.format(day);
    const mm = digitFmt.format(m);
    const yyyy = yearFmt.format(y);
    const sep = o.dateFormat.includes("/") ? "/" : "-";
    return o.dateFormat.startsWith("dd") ? [dd, mm, yyyy].join(sep) : [mm, dd, yyyy].join(sep);
  };

  const time = (d: string | Date) => {
    const { h, min } = parts(d);
    if (o.timeFormat === "24") return `${digitFmt.format(h)}:${digitFmt.format(min)}`;
    const h12 = h % 12 || 12;
    const meridiem = locale === "bn" ? (h < 12 ? "পূর্বাহ্ণ" : "অপরাহ্ণ") : h < 12 ? "AM" : "PM";
    return `${yearFmt.format(h12)}:${digitFmt.format(min)} ${meridiem}`;
  };

  return {
    locale,
    money,
    /** Amount without the currency symbol, e.g. inside inputs or table footers. */
    amount: (n: number) => moneyFmt.format(n),
    number: (n: number) => intFmt.format(n),
    qty: (n: number) => qtyFmt.format(n),
    percent: (n: number) => `${pctFmt.format(n)}%`,
    compact: (n: number) => compactFmt.format(n),
    date,
    time,
    dateTime: (d: string | Date) => `${date(d)} ${time(d)}`,
    /** Unit labels for display: "Pc(s)" → "পিস" in Bangla; unknown units pass through. */
    unit: (name: string) => (locale === "bn" ? (BN_UNITS[name.trim().toLowerCase()] ?? name) : name),
    dateLong: (d: string | Date) => longFmt.format(toDate(d)),
  };
}

export function useFormat(): Formatter {
  const locale = useLocale();
  const { data: settings } = useSettings();
  const b = settings?.business;
  return useMemo(
    () =>
      createFormatter(
        locale,
        b && {
          symbol: b.currencySymbol,
          placement: b.currencyPlacement,
          precision: b.currencyPrecision,
          qtyPrecision: b.quantityPrecision,
          dateFormat: b.dateFormat,
          timeFormat: b.timeFormat,
          timeZone: b.timeZone,
        },
      ),
    [locale, b],
  );
}
