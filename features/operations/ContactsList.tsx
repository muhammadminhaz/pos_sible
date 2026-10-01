"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CoinsIcon, EyeIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCan } from "@/lib/auth/useCan";
import { useContactMutations, useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { contactsService, type ContactFilters, type ContactRow } from "@/lib/data/services/contacts";
import { useFormat } from "@/lib/i18n/format";
import { ContactFormDialog } from "./ContactForm";
import { opsErrorMessage } from "./opsError";
import { PayDueDialog } from "./PayDueDialog";

type Kind = "customer" | "supplier";
type UrlFilters = { group?: string; assigned?: string; status?: "active" | "inactive"; sellDue?: "1"; purchaseDue?: "1"; sellReturn?: "1"; purchaseReturn?: "1"; advance?: "1"; opening?: "1"; noSell?: string };
const KEYS = ["group", "assigned", "status", "sellDue", "purchaseDue", "sellReturn", "purchaseReturn", "advance", "opening", "noSell"] as const;

export function ContactsList({ kind }: { kind: Kind }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const permission = kind === "customer" ? "contacts.customer" : "contacts.supplier";
  const write = can(permission);
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>([...KEYS]);
  const [query, setQuery] = useTableQuery(`contacts-${kind}`);
  const filters: ContactFilters = {
    type: kind, search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort,
    customerGroupId: url.group, assignedTo: url.assigned, active: url.status, sellDue: !!url.sellDue || undefined, purchaseDue: !!url.purchaseDue || undefined,
    sellReturn: !!url.sellReturn || undefined, purchaseReturn: !!url.purchaseReturn || undefined, advance: !!url.advance || undefined, opening: !!url.opening || undefined,
    noSellMonths: url.noSell ? Number(url.noSell) : undefined,
  };
  const list = useContacts(filters);
  const m = useContactMutations();
  const [edit, setEdit] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const [del, setDel] = useState<ContactRow | null>(null);

  const toggle = async (c: ContactRow) => {
    await m.setActive.mutateAsync({ ids: [c.id], active: !c.active });
    toast.success(t(c.active ? "ops.deactivated" : "ops.activated"));
  };
  const money = (id: string, label: string, pick: (c: ContactRow) => number): ColumnDef<ContactRow> => ({
    id, accessorFn: pick, header: label, meta: { label, align: "right" }, cell: ({ row }) => <Money value={pick(row.original)} />,
  });
  const text = (id: keyof ContactRow, label: string): ColumnDef<ContactRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => (getValue<string>() ? String(getValue()) : "—") });

  const columns = useMemo<ColumnDef<ContactRow>[]>(() => [
    text("code", t("ops.code")),
    { id: "name", accessorKey: "name", header: t("catalog.name"), meta: { label: t("catalog.name") }, cell: ({ row }) => (
      <div className="min-w-0">
        <div className="font-medium">{row.original.name}</div>
        {row.original.businessName && <div className="text-xs text-muted-foreground">{row.original.businessName}</div>}
      </div>) },
    text("mobile", t("ops.mobile")),
    text("email", t("ops.email")),
    ...(kind === "customer" ? [text("groupName", t("ops.customerGroup"))] : []),
    text("taxNumber", t("ops.taxNumber")),
    ...(kind === "customer" ? [{ id: "creditLimit", accessorKey: "creditLimit", header: t("ops.creditLimit"), meta: { label: t("ops.creditLimit"), align: "right" as const }, cell: ({ row }: { row: { original: ContactRow } }) => (row.original.creditLimit != null ? <Money value={row.original.creditLimit} /> : "—") } as ColumnDef<ContactRow>] : []),
    money("openingBalance", t("ops.openingBalance"), (c) => c.openingBalance),
    money("due", kind === "customer" ? t("ops.sellDue") : t("ops.purchaseDue"), (c) => (kind === "customer" ? c.sellDue : c.purchaseDue)),
    money("returnDue", kind === "customer" ? t("ops.sellReturnDue") : t("ops.purchaseReturnDue"), (c) => (kind === "customer" ? c.sellReturnDue : c.purchaseReturnDue)),
    money("advanceBalance", t("ops.advance"), (c) => c.advanceBalance),
    ...(kind === "customer" ? [{ id: "points", accessorKey: "points", header: t("ops.points"), meta: { label: t("ops.points"), align: "right" as const }, cell: ({ row }: { row: { original: ContactRow } }) => <span className="tabular">{f.number(row.original.points)}</span> } as ColumnDef<ContactRow>] : []),
    { id: "active", accessorKey: "active", header: t("common.status"), meta: { label: t("common.status"), csv: (c) => (c.active ? t("common.active") : t("common.inactive")) }, cell: ({ row }) => <StatusBadge status={row.original.active ? "active" : "inactive"} /> },
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => {
      const c = row.original;
      return (
        <RowActions items={[
          { label: t("common.view"), icon: EyeIcon, href: `/contacts/${c.id}` },
          { label: t("common.edit"), icon: PencilIcon, onClick: () => setEdit(c.id), hidden: !write || c.isDefault },
          { label: t("ops.payDue"), icon: CoinsIcon, onClick: () => setPay(c.id), hidden: !write || c.isDefault || c.due <= 0 },
          { label: c.active ? t("common.deactivate") : t("common.activate"), icon: c.active ? PowerOffIcon : PowerIcon, onClick: () => toggle(c), hidden: !write || c.isDefault },
          { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(c), hidden: !write || c.isDefault },
        ]} />
      );
    } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, f, kind, write]);

  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const defs: FilterDef[] = [
    ...(kind === "customer" ? ([{ key: "group", label: t("ops.customerGroup"), type: "select", options: named(lookups?.customerGroups ?? []) }] as FilterDef[]) : []),
    { key: "assigned", label: t("ops.assignedTo"), type: "select", options: named((lookups?.users ?? []).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }))) },
    { key: "status", label: t("common.status"), type: "select", options: [{ value: "active", label: t("common.active") }, { value: "inactive", label: t("common.inactive") }] },
    ...(kind === "customer"
      ? ([
          { key: "sellDue", label: t("ops.sellDue"), type: "toggle" }, { key: "sellReturn", label: t("ops.sellReturnDue"), type: "toggle" },
          { key: "noSell", label: t("ops.noSell"), type: "select", options: [1, 3, 6, 12].map((n) => ({ value: String(n), label: t("ops.noSellMonths", { count: n }) })) },
        ] as FilterDef[])
      : ([{ key: "purchaseDue", label: t("ops.purchaseDue"), type: "toggle" }, { key: "purchaseReturn", label: t("ops.purchaseReturnDue"), type: "toggle" }] as FilterDef[])),
    { key: "advance", label: t("ops.hasAdvance"), type: "toggle" },
    { key: "opening", label: t("ops.hasOpening"), type: "toggle" },
  ];

  return (
    <>
      <PageHeader
        title={t(kind === "customer" ? "nav.customers" : "nav.suppliers")} description={t(kind === "customer" ? "ops.customersDescription" : "ops.suppliersDescription")}
        actions={write && <Button onClick={() => setEdit("new")}><PlusIcon />{t(kind === "customer" ? "ops.addCustomer" : "ops.addSupplier")}</Button>}
      />
      <div className="mb-4">
        <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} />
      </div>
      <DataTable
        tableId={`contacts-${kind}`} columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery}
        exportName={kind === "customer" ? "customers" : "suppliers"} exportRows={() => contactsService.list({ ...filters, page: 0, pageSize: -1 }).then((r) => r.rows)}
        defaultHidden={["email", "taxNumber", "creditLimit", "openingBalance", "advanceBalance", "points", "returnDue"]} onRowClick={(c) => router.push(`/contacts/${c.id}`)}
        empty={<EmptyState icon={UsersIcon} title={t("ops.noContacts")} />}
      />
      <ContactFormDialog editId={edit} defaultType={kind} onClose={() => setEdit(null)} />
      <PayDueDialog contactId={pay} onClose={() => setPay(null)} />
      <ConfirmDialog
        open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!del) return;
          try {
            await m.remove.mutateAsync([del.id]);
            toast.success(t("common.deleted"));
          } catch (e) {
            toast.error(opsErrorMessage(e, t));
          }
        }}
      />
    </>
  );
}
