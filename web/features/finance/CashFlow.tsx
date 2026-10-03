"use client";

import { PrinterIcon, WavesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { useCashFlow } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useFormat } from "@/lib/i18n/format";
import type { CashFlowRow } from "@/lib/data/services/ledgerReports";
import { PrintPortal, useReportPrint } from "@/features/reports/print";
import { useReportScope } from "./ReportControls";

type UrlFilters = { location?: string; account?: string; kind?: string; range?: string };

export function CashFlow() {
  const t = useTranslations();
  const f = useFormat();
  const { data: lookups } = useLookups();
  const { defaultLocation } = useReportScope();
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>(["location", "account", "kind", "range"]);
  const [query, setQuery] = useTableQuery("cash-flow");
  const { printing, print } = useReportPrint();
  const range = decodeRange(url.range);
  const { data } = useCashFlow({
    from: range?.from, to: range?.to, locationId: url.location ?? defaultLocation, accountId: url.account ?? null, kind: (url.kind as "credit" | "debit" | undefined) ?? null,
  });
  const rows = data?.rows ?? [];
  const pageRows = query.pageSize === -1 ? rows : rows.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);

  const text = (id: keyof CashFlowRow, label: string, render?: (r: CashFlowRow) => string): ColumnDef<CashFlowRow> => ({
    id, accessorKey: id, header: label, enableSorting: false, meta: { label, csv: render ? (r) => render(r) : undefined }, cell: ({ row }) => (render ? render(row.original) : String(row.original[id] ?? "")) || "—",
  });
  const columns: ColumnDef<CashFlowRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), enableSorting: false, meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    text("accountName", t("finance.accountName")),
    text("category", t("finance.entryType"), (r) => t(`finance.flow.${r.category}`)),
    text("description", t("finance.description"), (r) => (r.description ? t(`finance.txn.${r.description}`) : r.note)),
    text("refNo", t("ops.refNo")), text("locationName", t("common.location")),
    { id: "debit", header: t("finance.debit"), enableSorting: false, meta: { label: t("finance.debit"), align: "right", csv: (r) => (r.kind === "debit" ? r.amount : 0) }, cell: ({ row }) => <Money value={row.original.kind === "debit" ? row.original.amount : 0} muted /> },
    { id: "credit", header: t("finance.credit"), enableSorting: false, meta: { label: t("finance.credit"), align: "right", csv: (r) => (r.kind === "credit" ? r.amount : 0) }, cell: ({ row }) => <Money value={row.original.kind === "credit" ? row.original.amount : 0} muted /> },
  ];
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) },
    { key: "account", label: t("finance.accountName"), type: "select", options: (lookups?.accounts ?? []).map((a) => ({ value: a.id, label: a.name })) },
    { key: "kind", label: t("finance.entryDirection"), type: "select", options: [{ value: "credit", label: t("finance.moneyIn") }, { value: "debit", label: t("finance.moneyOut") }] },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];

  return (
    <>
      <PageHeader title={t("nav.cashFlow")} description={t("finance.flowDescription")} actions={<Button variant="outline" onClick={print}><PrinterIcon />{t("common.print")}</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label={t("finance.broughtForward")} value={<Money value={data?.opening ?? 0} />} />
        <StatCard label={t("finance.moneyIn")} value={<Money value={data?.totalIn ?? 0} />} />
        <StatCard label={t("finance.moneyOut")} value={<Money value={data?.totalOut ?? 0} />} />
        <StatCard label={t("finance.closingBalance")} value={<Money value={data?.closing ?? 0} />} />
      </div>
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} /></div>
      <DataTable
        tableId="cash-flow" columns={columns} data={pageRows} total={rows.length} loading={!data} query={query} onQueryChange={setQuery}
        exportName="cash-flow" exportRows={async () => rows} empty={<EmptyState icon={WavesIcon} title={t("finance.noFlow")} />}
      />
      <PrintPortal printing={printing}>
        <h1 className="mb-2 text-lg font-semibold">{t("nav.cashFlow")}</h1>
        <p className="mb-3">{`${t("finance.broughtForward")}: ${f.money(data?.opening ?? 0)} · ${t("finance.moneyIn")}: ${f.money(data?.totalIn ?? 0)} · ${t("finance.moneyOut")}: ${f.money(data?.totalOut ?? 0)} · ${t("finance.closingBalance")}: ${f.money(data?.closing ?? 0)}`}</p>
        <table className="w-full border-collapse text-left">
          <thead><tr className="border-b">{[t("common.date"), t("finance.accountName"), t("finance.description"), t("ops.refNo"), t("finance.debit"), t("finance.credit")].map((h) => <th key={h} className="py-1">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b"><td className="py-0.5">{f.dateTime(r.date)}</td><td>{r.accountName}</td><td>{r.description ? t(`finance.txn.${r.description}`) : r.note}</td><td>{r.refNo}</td><td>{r.kind === "debit" ? f.money(r.amount) : ""}</td><td>{r.kind === "credit" ? f.money(r.amount) : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </PrintPortal>
    </>
  );
}
