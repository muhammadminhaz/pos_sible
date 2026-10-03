"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLineIcon, ArrowLeftRightIcon, BookOpenIcon, LandmarkIcon, LockIcon, LockOpenIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/lib/auth/useCan";
import { useAccountMutations, useAccounts } from "@/lib/data/hooks/finance";
import type { AccountRow } from "@/lib/data/services/accounts";
import { AccountFormDialog, MoveMoneyDialog, type MoveMode } from "./AccountDialogs";
import { AccountTypes } from "./AccountTypes";
import { financeErrorMessage } from "./financeError";

type UrlFilters = { status?: string };

export function AccountsList() {
  const t = useTranslations();
  const router = useRouter();
  const can = useCan();
  const manage = can("account.manage");
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>(["status"]);
  const [query, setQuery] = useTableQuery("accounts");
  const status = (url.status as "active" | "closed" | undefined) ?? "active";
  const list = useAccounts({ status, search: query.search || undefined });
  const m = useAccountMutations();
  const [edit, setEdit] = useState<AccountRow | null | undefined>(undefined);
  const [move, setMove] = useState<MoveMode | null>(null);

  const act = (fn: () => Promise<unknown>, done: string) => async () => {
    try {
      await fn();
      toast.success(t(done));
    } catch (e) {
      toast.error(financeErrorMessage(e, t));
    }
  };
  const text = (id: keyof AccountRow, label: string): ColumnDef<AccountRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => String(getValue() ?? "") || "—" });
  const columns: ColumnDef<AccountRow>[] = [
    { id: "name", accessorKey: "name", header: t("common.name"), meta: { label: t("common.name") }, cell: ({ row }) => <span className="inline-flex items-center gap-2 font-medium">{row.original.name}{row.original.status === "closed" && <Badge variant="outline">{t("finance.closed")}</Badge>}</span> },
    text("typeName", t("finance.accountType")), text("subTypeName", t("finance.subType")), text("number", t("finance.accountNumber")), text("note", t("common.note")),
    { id: "balance", accessorKey: "balance", header: t("finance.balance"), meta: { label: t("finance.balance"), align: "right" }, cell: ({ row }) => <Money value={row.original.balance} /> },
    { id: "details", enableSorting: false, header: t("finance.accountDetails"), meta: { label: t("finance.accountDetails"), csv: (r) => r.details.map((d) => `${d.label}: ${d.value}`).join("; ") }, cell: ({ row }) => row.original.details.map((d) => `${d.label}: ${d.value}`).join(", ") || "—" },
    text("addedBy", t("finance.addedBy")),
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => {
      const a = row.original;
      const open = a.status === "active";
      return (
        <RowActions items={[
          { label: t("finance.book"), icon: BookOpenIcon, href: `/accounts/${a.id}` },
          { label: t("common.edit"), icon: PencilIcon, onClick: () => setEdit(a), hidden: !manage },
          { label: t("finance.transfer"), icon: ArrowLeftRightIcon, onClick: () => setMove({ kind: "transfer", accountId: a.id }), hidden: !manage || !open },
          { label: t("finance.deposit"), icon: ArrowDownToLineIcon, onClick: () => setMove({ kind: "deposit", accountId: a.id }), hidden: !manage || !open },
          { label: t("finance.closeAccount"), icon: LockIcon, onClick: act(() => m.close.mutateAsync(a.id), "finance.accountClosed"), hidden: !manage || !open },
          { label: t("finance.reopenAccount"), icon: LockOpenIcon, onClick: act(() => m.reopen.mutateAsync(a.id), "finance.accountReopened"), hidden: !manage || open },
        ]} />
      );
    } },
  ];

  const defs: FilterDef[] = [{ key: "status", label: t("common.status"), type: "select", options: [{ value: "active", label: t("common.active") }, { value: "closed", label: t("finance.closed") }] }];
  const all = list.data ?? [];
  const pageRows = query.pageSize === -1 ? all : all.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);

  return (
    <>
      <PageHeader title={t("nav.listAccounts")} description={t("finance.accountsDescription")} />
      <Tabs defaultValue="accounts">
        <TabsList className="mb-4">
          <TabsTrigger value="accounts">{t("finance.tabAccounts")}</TabsTrigger>
          <TabsTrigger value="types">{t("finance.tabTypes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} />
            {manage && <Button onClick={() => setEdit(null)}><PlusIcon />{t("finance.addAccount")}</Button>}
          </div>
          <DataTable
            tableId="accounts" columns={columns} data={pageRows} total={all.length} loading={list.isFetching} query={query} onQueryChange={setQuery}
            exportName="accounts" exportRows={async () => all} onRowClick={(a) => router.push(`/accounts/${a.id}`)}
            empty={<EmptyState icon={LandmarkIcon} title={t("finance.noAccounts")} />}
          />
        </TabsContent>
        <TabsContent value="types"><AccountTypes /></TabsContent>
      </Tabs>
      <AccountFormDialog account={edit} onClose={() => setEdit(undefined)} />
      <MoveMoneyDialog mode={move} onClose={() => setMove(null)} />
    </>
  );
}
