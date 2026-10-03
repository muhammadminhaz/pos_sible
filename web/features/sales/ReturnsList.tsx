"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusIcon, Trash2Icon, Undo2Icon, EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useReturnMutations, useReturns } from "@/lib/data/hooks/sales";
import type { ReturnRow } from "@/lib/data/services/returns";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { saleErrorMessage } from "./saleError";

type Url = { location?: string; customer?: string; user?: string; range?: string };

export function ReturnsList() {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { data: customers } = useContacts({ type: "customer", pageSize: -1 });
  const { remove } = useReturnMutations();
  const [url, setUrl, reset] = useUrlFilters<Url>(["location", "customer", "user", "range"]);
  const [query, setQuery] = useTableQuery("sales-returns");
  const [toDelete, setToDelete] = useState<ReturnRow | null>(null);
  const range = decodeRange(url.range);
  const list = useReturns({ search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort, locationId: url.location ?? (g === "all" ? undefined : g), contactId: url.customer, createdBy: url.user, from: range?.from, to: range?.to });

  const text = (id: keyof ReturnRow, label: string): ColumnDef<ReturnRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const money = (id: "total" | "due", label: string): ColumnDef<ReturnRow> => ({ id, accessorKey: id, header: label, meta: { label, align: "right" }, cell: ({ row }) => <Money value={row.original[id]} muted /> });
  const columns: ColumnDef<ReturnRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "refNo", accessorKey: "refNo", header: t("sales.invoiceNo"), meta: { label: t("sales.invoiceNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    { id: "parentRef", accessorKey: "parentRef", header: t("sales.parentSale"), meta: { label: t("sales.parentSale") }, cell: ({ row }) => (row.original.parentId ? <Link href={`/sales/${row.original.parentId}`} className="tabular hover:underline">{row.original.parentRef}</Link> : "—") },
    text("contactName", t("sales.customer")), text("locationName", t("common.location")),
    { id: "paymentStatus", accessorKey: "paymentStatus", header: t("sales.paymentStatus"), meta: { label: t("sales.paymentStatus"), csv: (r) => t(`status.${r.paymentStatus}`) }, cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
    money("total", t("common.total")), money("due", t("sales.sellDue")),
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => <RowActions items={[{ label: t("sales.viewParentSale"), icon: EyeIcon, href: `/sales/${row.original.parentId}`, hidden: !row.original.parentId }, { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setToDelete(row.original), hidden: !can("sell.delete") }]} /> },
  ];
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "customer", label: t("sales.customer"), type: "select", options: named(customers?.rows ?? []) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
    { key: "user", label: t("sales.user"), type: "select", options: (lookups?.users ?? []).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() })) },
  ];
  return (
    <>
      <PageHeader title={t("nav.sellReturns")} description={t("sales.returnsDescription")} actions={can("sell.create") && <Button asChild><Link href="/sales/returns/new"><PlusIcon />{t("sales.newReturn")}</Link></Button>} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} /></div>
      <DataTable tableId="sales-returns" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="sell-returns" empty={<EmptyState icon={Undo2Icon} title={t("sales.noReturns")} />} />
      <ConfirmDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)} destructive title={t("sales.deleteReturnTitle")} description={t("sales.deleteReturnBody")} confirmLabel={t("common.delete")}
        onConfirm={async () => { if (!toDelete) return; try { await remove.mutateAsync(toDelete.id); toast.success(t("sales.returnDeleted")); } catch (e) { toast.error(saleErrorMessage(e, t)); } }} />
    </>
  );
}
