const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join(", ") : String(v);
  return /[",\n\r]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV; the header row is the union of keys in first-seen order. */
export function toCSV(rows: Record<string, unknown>[]): string {
  const headers: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!headers.includes(k)) headers.push(k);
  return [headers.map(cell).join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n");
}

const slug = (s: string) =>
  s.normalize("NFKD").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase();

/**
 * A name that says what the file is and where it came from: `acme-traders_sales_2026-10-03_14-05.csv`
 * (business, what was exported, date, time). Anything unsafe in a file name becomes a dash; an empty part is left out.
 */
export function exportFileName(what: string, business?: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const time = `${p(now.getHours())}-${p(now.getMinutes())}`;
  return [business && slug(business), slug(what), date, time].filter(Boolean).join("_");
}

export function downloadCSV(name: string, csv: string): void {
  // BOM so Excel opens Bangla text as UTF-8.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name.endsWith(".csv") ? name : `${name}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
