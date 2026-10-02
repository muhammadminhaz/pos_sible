"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon, CalendarPlusIcon, PencilIcon, PlusIcon, ReceiptIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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
import { useExpenseMutations, useExpenses } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import { PAYMENT_STATUSES } from "@/lib/data/schemas";
import { expensesService, type ExpenseFilters, type ExpenseRow } from "@/lib/data/services/expenses";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { financeErrorMessage } from "./financeError";

type UrlFilters = { location?: string; category?: string; sub?: string; contact?: string; user?: string; payment?: string; range?: string };
const KEYS = ["location", "category", "sub", "contact", "user", "payment", "range"] as const;

export function ExpensesList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const { data: contacts } = useContacts({ pageSize: -1 });
  const globalLocation = useUI((s) => s.locationId);
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>([...KEYS]);
  const [query, setQuery] = useTableQuery("expenses");
  const range = decodeRange(url.range);
  const filters: ExpenseFilters = {
    search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort ?? { id: "date", desc: true },
    locationId: url.location ?? (globalLocation === "all" ? undefined : globalLocation), categoryId: url.category, subCategoryId: url.sub, contactId: url.contact, userId: url.user,
    paymentStatus: url.payment as ExpenseFilters["paymentStatus"], from: range?.from, to: range?.to,
  };
  const list = useExpenses(filters);
  const m = useExpenseMutations();
  const [del, setDel] = useState<ExpenseRow | null>(null);
  const [payments, setPayments] = useState<{ id: string; mode: "add" | "view" } | null>(null);

  const recurringLabel = (r: ExpenseRow["recurring"]) => {
    if (!r) return "";
    const unit = t(`catalog.${r.intervalType}`).toLowerCase();
    const copy = r.parentId ? ` · ${t("finance.generatedCopy")}` : "";
    return `${t("finance.every", { n: f.number(r.interval), unit })}${r.repetitions != null ? ` · ${t("finance.repetitions", { n: f.number(r.repetitions) })}` : ""}${copy}`;
  };
  const text = (id: keyof ExpenseRow, label: string): ColumnDef<ExpenseRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const money = (id: "tax" | "total" | "due", label: string): ColumnDef<ExpenseRow> => ({ id, accessorKey: id, header: label, meta: { label, align: "right" }, cell: ({ row }) => <Money value={row.original[id]} /> });
  const columns: ColumnDef<ExpenseRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    {
      id: "refNo", accessorKey: "refNo", header: t("ops.refNo"), meta: { label: t("ops.refNo") },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2"><span className="font-medium tabular">{row.original.refNo}</span>{row.original.isRefund && <Badge variant="outline">{t("finance.refund")}</Badge>}</span>
      ),
    },
    { id: "recurring", enableSorting: false, header: t("finance.recurringDetails"), meta: { label: t("finance.recurringDetails"), csv: (r) => recurringLabel(r.recurring) }, cell: ({ row }) => recurringLabel(row.original.recurring) || "—" },
    text("categoryName", t("finance.category")), text("subCategoryName", t("finance.subCategory")), text("locationName", t("common.location")),
    { id: "paymentStatus", accessorKey: "paymentStatus", header: t("sales.paymentStatus"), meta: { label: t("sales.paymentStatus"), csv: (r) => t(`status.${r.paymentStatus}`) }, cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
    money("tax", t("products.tax")), money("total", t("common.total")), money("due", t("status.due")),
    text("forUserName", t("finance.expenseFor")), text("contactName", t("finance.contact")), text("note", t("common.note")), text("addedBy", t("sales.user")),
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => {
      const x = row.original;
      return (
        <RowActions items={[
          { label: t("common.edit"), icon: PencilIcon, href: `/expenses/${x.id}/edit`, hidden: !can("expense.update") },
          { label: t("ops.addPayment"), icon: BanknoteIcon, onClick: () => setPayments({ id: x.id, mode: "add" }), hidden: !can("expense.update") || x.due === 0 },
          { label: t("ops.viewPayments"), icon: BanknoteIcon, onClick: () => setPayments({ id: x.id, mode: "view" }), hidden: x.paid === 0 },
          {
            label: t("finance.generateNext"), icon: CalendarPlusIcon, hidden: !can("expense.create") || !x.recurring || !!x.recurring.parentId,
            onClick: async () => {
              try {
                const next = await m.generateNext.mutateAsync(x.id);
                toast.success(t("finance.nextGenerated", { refNo: next.refNo }));
              } catch (e) {
                toast.error(financeErrorMessage(e, t));
              }
            },
          },
          { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(x), hidden: !can("expense.delete") },
        ]} />
      );
    } },
  ];

  const cats = lookups?.expenseCategories ?? [];
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "category", label: t("finance.category"), type: "select", options: named(cats.filter((c) => !c.parentId)) },
    { key: "sub", label: t("finance.subCategory"), type: "select", options: named(cats.filter((c) => c.parentId && (!url.category || c.parentId === url.category))) },
    { key: "contact", label: t("finance.contact"), type: "select", options: named(contacts?.rows ?? []) },
    { key: "user", label: t("finance.expenseFor"), type: "select", options: (lookups?.users ?? []).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() })) },
    { key: "payment", label: t("sales.paymentStatus"), type: "select", options: PAYMENT_STATUSES.map((v) => ({ value: v, label: t(`status.${v}`) })) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];
  const totals = list.data?.totals;

  return (
    <>
      <PageHeader
        title={t("nav.listExpenses")} description={t("finance.expensesDescription")}
        actions={can("expense.create") && <Button asChild><Link href="/expenses/new"><PlusIcon />{t("nav.addExpense")}</Link></Button>}
      />
      <div className="mb-4">
        <FilterBar defs={defs} value={url} onChange={(p) => { setUrl("category" in p ? { ...p, sub: undefined } : p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} />
      </div>
      <DataTable
        tableId="expenses" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery}
        exportName="expenses" exportRows={() => expensesService.list({ ...filters, page: 0, pageSize: -1 }).then((r) => r.rows)}
        onRowClick={(x) => can("expense.update") && router.push(`/expenses/${x.id}/edit`)}
        empty={<EmptyState icon={ReceiptIcon} title={t("finance.noExpenses")} />}
        footer={totals ? () => ({ refNo: t("finance.footerTotals"), tax: <Money value={totals.tax} />, total: <Money value={totals.total} />, due: <Money value={totals.due} /> }) : undefined}
      />
      <PaymentsDialog saleId={payments?.id ?? null} mode={payments?.mode ?? "view"} kind="expense" onClose={() => setPayments(null)} />
      <ConfirmDialog
        open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("finance.deleteExpenseTitle")} description={t("finance.deleteExpenseBody")} confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!del) return;
          try {
            await m.remove.mutateAsync(del.id);
            toast.success(t("common.deleted"));
          } catch (e) {
            toast.error(financeErrorMessage(e, t));
          }
        }}
      />
    </>
  );
}
