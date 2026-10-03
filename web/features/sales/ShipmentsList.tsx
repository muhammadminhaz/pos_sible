"use client";

import { useState } from "react";
import { TruckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSalesList } from "@/lib/data/hooks/sales";
import { PAYMENT_STATUSES, SHIPPING_STATUSES } from "@/lib/data/schemas";
import type { SaleFilters, SaleListRow } from "@/lib/data/services/sales";
import { useUI } from "@/lib/data/store/ui";
import { ShippingDialog } from "./ShippingDialog";

type Url = { location?: string; customer?: string; user?: string; payment?: string; shipping?: string; person?: string; range?: string };
const ship = (v: string) => (v === "ordered" ? "ordered_shipping" : v);

export function ShipmentsList() {
  const t = useTranslations();
  const can = useCan();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { data: customers } = useContacts({ type: "customer", pageSize: -1 });
  const [url, setUrl, reset] = useUrlFilters<Url>(["location", "customer", "user", "payment", "shipping", "person", "range"]);
  const [query, setQuery] = useTableQuery("sales-shipments");
  const [editId, setEditId] = useState<string | null>(null);
  const range = decodeRange(url.range);
  const list = useSalesList({
    kind: "all", shipped: true, search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort ?? { id: "date", desc: true },
    locationId: url.location ?? (g === "all" ? undefined : g), contactId: url.customer, createdBy: url.user, paymentStatus: url.payment as SaleFilters["paymentStatus"],
    shippingStatus: url.shipping as SaleFilters["shippingStatus"], deliveryPersonId: url.person, from: range?.from, to: range?.to,
  });

  const text = (id: keyof SaleListRow, label: string): ColumnDef<SaleListRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const columns: ColumnDef<SaleListRow>[] = [
    { id: "refNo", accessorKey: "refNo", header: t("sales.invoiceNo"), meta: { label: t("sales.invoiceNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    text("contactName", t("sales.customer")), text("mobile", t("sales.mobile")), text("locationName", t("common.location")), text("deliveryPerson", t("sales.deliveryPerson")),
    { id: "shippingStatus", accessorKey: "shippingStatus", header: t("sales.shippingStatus"), meta: { label: t("sales.shippingStatus"), csv: (r) => r.shippingStatus ?? "" }, cell: ({ row }) => (row.original.shippingStatus ? <StatusBadge status={ship(row.original.shippingStatus)} /> : "—") },
    { id: "paymentStatus", accessorKey: "paymentStatus", header: t("sales.paymentStatus"), meta: { label: t("sales.paymentStatus"), csv: (r) => t(`status.${r.paymentStatus}`) }, cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => <RowActions items={[{ label: t("sales.editShipping"), icon: TruckIcon, onClick: () => setEditId(row.original.id), hidden: !can("sell.update") }]} /> },
  ];
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const people = (lookups?.users ?? []).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "customer", label: t("sales.customer"), type: "select", options: named(customers?.rows ?? []) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
    { key: "user", label: t("sales.user"), type: "select", options: named(people) },
    { key: "payment", label: t("sales.paymentStatus"), type: "select", options: PAYMENT_STATUSES.map((v) => ({ value: v, label: t(`status.${v}`) })) },
    { key: "shipping", label: t("sales.shippingStatus"), type: "select", options: SHIPPING_STATUSES.map((v) => ({ value: v, label: t(`status.${ship(v)}`) })) },
    { key: "person", label: t("sales.deliveryPerson"), type: "select", options: named(people) },
  ];
  return (
    <>
      <PageHeader title={t("nav.shipments")} description={t("sales.shipmentsDescription")} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} /></div>
      <DataTable tableId="sales-shipments" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="shipments" onRowClick={(r) => can("sell.update") && setEditId(r.id)} empty={<EmptyState icon={TruckIcon} title={t("sales.noShipments")} />} />
      <ShippingDialog saleId={editId} onClose={() => setEditId(null)} />
    </>
  );
}
