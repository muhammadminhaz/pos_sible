"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLineIcon, ArrowLeftRightIcon, ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, useTableQuery } from "@/components/shared/DataTable";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useCan } from "@/lib/auth/useCan";
import { useAccount, useAccountBook } from "@/lib/data/hooks/finance";
import type { BookRow } from "@/lib/data/services/accounts";
import { useFormat } from "@/lib/i18n/format";
import { MoveMoneyDialog, type MoveMode } from "./AccountDialogs";

export function AccountBook({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const [url, setUrl, resetUrl] = useUrlFilters<{ range?: string }>(["range"]);
  const [query, setQuery] = useTableQuery("account-book");
  const range = decodeRange(url.range);
  const account = useAccount(id);
  const book = useAccountBook(id, { from: range?.from, to: range?.to });
  const [move, setMove] = useState<MoveMode | null>(null);
  if (account.isLoading || !account.data) return <Skeleton className="h-96" />;
  const a = account.data;
  const open = a.status === "active";
  const manage = can("account.manage") && open;

  const rows = book.data?.rows ?? [];
  const pageRows = query.pageSize === -1 ? rows : rows.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);
  const money = (key: "credit" | "debit" | "balance", label: string): ColumnDef<BookRow> => ({ id: key, accessorKey: key, header: label, meta: { label, align: "right" }, cell: ({ row }) => <Money value={row.original[key]} muted /> });
  const columns: ColumnDef<BookRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), enableSorting: false, meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "subType", accessorKey: "subType", header: t("finance.entryType"), enableSorting: false, meta: { label: t("finance.entryType"), csv: (r) => t(`finance.entry.${r.subType}`) }, cell: ({ row }) => t(`finance.entry.${row.original.subType}`) },
    { id: "description", accessorKey: "description", header: t("finance.description"), enableSorting: false, meta: { label: t("finance.description") }, cell: ({ row }) => row.original.description ? (t.has(`finance.txn.${row.original.description}`) ? t(`finance.txn.${row.original.description}`) : row.original.description) : "—" },
    { id: "refNo", accessorKey: "refNo", header: t("ops.refNo"), enableSorting: false, meta: { label: t("ops.refNo") }, cell: ({ row }) => <span className="tabular">{row.original.refNo || "—"}</span> },
    { id: "note", accessorKey: "note", header: t("common.note"), enableSorting: false, meta: { label: t("common.note") }, cell: ({ row }) => row.original.note || "—" },
    money("debit", t("finance.debit")), money("credit", t("finance.credit")), money("balance", t("finance.balance")),
    { id: "addedBy", accessorKey: "addedBy", header: t("finance.addedBy"), enableSorting: false, meta: { label: t("finance.addedBy") }, cell: ({ row }) => row.original.addedBy || "—" },
  ];
  const defs: FilterDef[] = [{ key: "range", label: t("sales.dateRange"), type: "daterange" }];

  return (
    <>
      <PageHeader
        title={a.name} description={[a.typeName, a.subTypeName, a.number].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button asChild variant="ghost"><Link href="/accounts"><ChevronLeftIcon />{t("common.back")}</Link></Button>
            {manage && <Button variant="outline" onClick={() => setMove({ kind: "transfer", accountId: id })}><ArrowLeftRightIcon />{t("finance.transfer")}</Button>}
            {manage && <Button variant="outline" onClick={() => setMove({ kind: "deposit", accountId: id })}><ArrowDownToLineIcon />{t("finance.deposit")}</Button>}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label={t("finance.broughtForward")} value={<Money value={book.data?.opening ?? 0} />} />
        <StatCard label={t("finance.closingBalance")} value={<Money value={book.data?.closing ?? 0} />} />
        <StatCard label={t("finance.currentBalance")} value={<Money value={a.balance} />} />
      </div>
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} /></div>
      <DataTable
        tableId="account-book" columns={columns} data={pageRows} total={rows.length} loading={book.isFetching} query={query} onQueryChange={setQuery}
        exportName={`account-book-${a.name}`} exportRows={async () => rows}
      />
      <MoveMoneyDialog mode={move} onClose={() => setMove(null)} />
    </>
  );
}
