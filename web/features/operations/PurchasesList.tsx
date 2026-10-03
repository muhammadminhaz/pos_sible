"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BanknoteIcon, EyeIcon, PencilIcon, PlusIcon, RefreshCwIcon, ShoppingBagIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { PaymentsDialog } from "@/features/sales/PaymentsDialog";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePurchaseMutations, usePurchases } from "@/lib/data/hooks/operations";
import { PAYMENT_STATUSES } from "@/lib/data/schemas";
import { purchasesService, type PurchaseFilters, type PurchaseRow } from "@/lib/data/services/purchases";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { opsErrorMessage } from "./opsError";
import { PurchaseStatusDialog } from "./StatusDialog";

type UrlFilters = { location?: string; supplier?: string; status?: string; payment?: string; range?: string };
const KEYS = ["location", "supplier", "status", "payment", "range"] as const;

export function PurchasesList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const { data: suppliers } = useContacts({ type: "supplier", pageSize: -1 });
  const globalLocation = useUI((s) => s.locationId);
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>([...KEYS]);
  const [query, setQuery] = useTableQuery("purchases");
  const range = decodeRange(url.range);
  const filters: PurchaseFilters = {
    search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort ?? { id: "date", desc: true },
    locationId: url.location ?? (globalLocation === "all" ? undefined : globalLocation), contactId: url.supplier, status: url.status as PurchaseFilters["status"],
    paymentStatus: url.payment as PurchaseFilters["paymentStatus"], from: range?.from, to: range?.to,
  };
  const list = usePurchases(filters);
  const m = usePurchaseMutations();
  const [del, setDel] = useState<PurchaseRow | null>(null);
  const [payments, setPayments] = useState<{ id: string; mode: "add" | "view" } | null>(null);
  const [status, setStatus] = useState<{ id: string; status: PurchaseRow["status"] } | null>(null);

  const text = (id: keyof PurchaseRow, label: string): ColumnDef<PurchaseRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const money = (id: "total" | "paid" | "due", label: string): ColumnDef<PurchaseRow> => ({ id, accessorKey: id, header: label, meta: { label, align: "right" }, cell: ({ row }) => <Money value={row.original[id]} /> });
  const columns: ColumnDef<PurchaseRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "refNo", accessorKey: "refNo", header: t("ops.refNo"), meta: { label: t("ops.refNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    text("locationName", t("common.location")),
    text("supplierName", t("ops.supplier")),
    { id: "status", accessorKey: "status", header: t("ops.purchaseStatus"), meta: { label: t("ops.purchaseStatus"), csv: (r) => t(`status.${r.status}`) }, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "paymentStatus", accessorKey: "paymentStatus", header: t("sales.paymentStatus"), meta: { label: t("sales.paymentStatus"), csv: (r) => t(`status.${r.paymentStatus}`) }, cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
    money("total", t("common.total")), money("paid", t("ops.paid")), money("due", t("status.due")),
    text("addedBy", t("sales.user")),
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => {
      const p = row.original;
      return (
        <RowActions items={[
          { label: t("common.view"), icon: EyeIcon, href: `/purchases/${p.id}` },
          { label: t("common.edit"), icon: PencilIcon, href: `/purchases/${p.id}/edit`, hidden: !can("purchase.update") },
          { label: t("ops.addPayment"), icon: BanknoteIcon, onClick: () => setPayments({ id: p.id, mode: "add" }), hidden: !can("purchase.payments") || p.due <= 0 },
          { label: t("ops.viewPayments"), icon: BanknoteIcon, onClick: () => setPayments({ id: p.id, mode: "view" }), hidden: p.paid <= 0 },
          { label: t("ops.updateStatus"), icon: RefreshCwIcon, onClick: () => setStatus({ id: p.id, status: p.status }), hidden: !can("purchase.update") },
          { label: t("nav.addPurchaseReturn"), icon: Undo2Icon, href: `/purchases/returns/new?purchase=${p.id}`, hidden: !can("purchase.update") || p.status !== "received" },
          { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(p), hidden: !can("purchase.delete") },
        ]} />
      );
    } },
  ];

  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "supplier", label: t("ops.supplier"), type: "select", options: named(suppliers?.rows ?? []) },
    { key: "status", label: t("ops.purchaseStatus"), type: "select", options: (["received", "pending", "ordered"] as const).map((v) => ({ value: v, label: t(`status.${v}`) })) },
    { key: "payment", label: t("sales.paymentStatus"), type: "select", options: PAYMENT_STATUSES.map((v) => ({ value: v, label: t(`status.${v}`) })) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];
  const totals = list.data?.totals;

  return (
    <>
      <PageHeader
        title={t("nav.listPurchases")} description={t("ops.purchasesDescription")}
        actions={can("purchase.create") && <Button asChild><Link href="/purchases/new"><PlusIcon />{t("nav.addPurchase")}</Link></Button>}
      />
      <div className="mb-4">
        <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} />
      </div>
      <DataTable
        tableId="purchases" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery}
        exportName="purchases" exportRows={() => purchasesService.list({ ...filters, page: 0, pageSize: -1 }).then((r) => r.rows)} onRowClick={(p) => router.push(`/purchases/${p.id}`)}
        empty={<EmptyState icon={ShoppingBagIcon} title={t("ops.noPurchases")} />}
        footer={totals ? () => ({ refNo: t("sales.footerTotals"), total: <Money value={totals.total} />, paid: <Money value={totals.paid} />, due: <Money value={totals.due} /> }) : undefined}
      />
      <PaymentsDialog saleId={payments?.id ?? null} mode={payments?.mode ?? "view"} kind="purchase" onClose={() => setPayments(null)} />
      <PurchaseStatusDialog target={status} onClose={() => setStatus(null)} />
      <ConfirmDialog
        open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("ops.deletePurchaseTitle")} description={t("ops.deletePurchaseBody")} confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!del) return;
          try {
            await m.remove.mutateAsync(del.id);
            toast.success(t("common.deleted"));
          } catch (e) {
            toast.error(opsErrorMessage(e, t));
          }
        }}
      />
    </>
  );
}
