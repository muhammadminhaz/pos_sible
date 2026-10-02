"use client";

import type { ReactNode } from "react";
import { FileBarChartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { useFormat } from "@/lib/i18n/format";

export type ColKind = "text" | "money" | "qty" | "number" | "date" | "datetime" | "percent";
export type Col<R> = {
  key: keyof R & string;
  /** Column id when several columns read the same `key` (e.g. one per payment method). */
  id?: string;
  label: string;
  kind?: ColKind;
  render?: (r: R) => ReactNode;
  /** Plain value for CSV when `render` returns markup. */
  csv?: (r: R) => unknown;
  /** Show the report total for this column in the footer. */
  total?: boolean;
};

/**
 * A client-paged table over a report's rows: formatting by column kind, a totals footer and CSV of the whole filtered set.
 * Rows are already computed, so sorting is by what the report returned; the empty state replaces the table when there are none.
 */
export function ReportTable<R>({
  id, columns, rows: all, totals: reportTotals, loading, empty, getRowId,
}: {
  id: string; columns: Col<R>[]; rows: R[]; totals?: Partial<Record<string, number>>; loading?: boolean; empty?: string; getRowId?: (r: R) => string;
}) {
  const t = useTranslations();
  const f = useFormat();
  const [query, setQuery] = useTableQuery(`report-${id}`);
  // The search box narrows the report's own rows; totals then follow what is shown.
  const term = query.search.trim().toLowerCase();
  const rows = term ? all.filter((r) => Object.values(r as Record<string, unknown>).some((v) => typeof v !== "object" && String(v).toLowerCase().includes(term))) : all;
  const totals = term
    ? Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, Math.round(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) * 100) / 100]))
    : reportTotals;
  const cell = (c: Col<R>, r: R): ReactNode => {
    if (c.render) return c.render(r);
    const v = r[c.key] as unknown;
    if (v === null || v === undefined || v === "") return "—";
    switch (c.kind) {
      case "money": return <Money value={Number(v)} muted />;
      case "qty": return <span className="tabular">{f.qty(Number(v))}</span>;
      case "number": return <span className="tabular">{f.number(Number(v))}</span>;
      case "percent": return <span className="tabular">{f.number(Number(v))}%</span>;
      case "date": return <span className="tabular">{f.date(String(v))}</span>;
      case "datetime": return <span className="tabular">{f.dateTime(String(v))}</span>;
      default: return String(v);
    }
  };
  const numeric = (k?: ColKind) => k === "money" || k === "qty" || k === "number" || k === "percent";
  const columnDefs: ColumnDef<R>[] = columns.map((c) => ({
    id: c.id ?? c.key, header: c.label, enableSorting: false,
    meta: { label: c.label, align: numeric(c.kind) ? "right" : undefined, className: c.kind === "date" || c.kind === "datetime" ? "whitespace-nowrap" : undefined, csv: c.csv ?? ((r: R) => r[c.key]) },
    cell: ({ row }) => cell(c, row.original),
  }));
  const footer = totals && columns.some((c) => c.total)
    ? () => {
        const out: Record<string, ReactNode> = {};
        columns.forEach((c, i) => {
          if (c.total && totals[c.key] !== undefined) out[c.id ?? c.key] = c.kind === "money" ? <Money value={totals[c.key]!} /> : <span className="tabular">{f.qty(totals[c.key]!)}</span>;
          else if (i === 0) out[c.id ?? c.key] = t("reports.totals");
        });
        return out;
      }
    : undefined;
  const pageRows = query.pageSize === -1 ? rows : rows.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);
    return (
    <DataTable
      tableId={`report-${id}`} columns={columnDefs} data={pageRows} total={rows.length} loading={loading} query={query} onQueryChange={setQuery}
      exportName={id} exportRows={async () => rows} getRowId={getRowId ? getRowId : undefined}
      empty={<EmptyState icon={FileBarChartIcon} title={empty ?? t("reports.empty")} />} footer={footer}
    />
  );
}
