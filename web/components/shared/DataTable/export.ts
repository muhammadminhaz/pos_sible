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
