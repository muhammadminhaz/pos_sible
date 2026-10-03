"use client";

import { useState, type FormEvent } from "react";
import { LinkIcon, WalletIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { PickField } from "@/features/catalog/formParts";
import { useCan } from "@/lib/auth/useCan";
import { useAccountMutations, useAccounts, usePaymentReport } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import { accountsService, type PaymentReportFilters, type PaymentReportRow } from "@/lib/data/services/accounts";
import { useFormat } from "@/lib/i18n/format";
import { financeErrorMessage } from "./financeError";

const TYPES = ["sell", "sell_return", "purchase", "purchase_return", "expense"] as const;
type UrlFilters = { account?: string; linked?: string; type?: string; location?: string; range?: string };

function LinkBody({ row, onClose }: { row: PaymentReportRow; onClose: () => void }) {
  const t = useTranslations();
  const { data: accounts } = useAccounts({ status: "active" });
  const { linkAccount } = useAccountMutations();
  const [accountId, setAccountId] = useState<string | null>(row.accountId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    try {
      await linkAccount.mutateAsync({ transactionId: row.transactionId, paymentId: row.paymentId, accountId });
      toast.success(t("finance.accountLinked"));
      onClose();
    } catch (err) {
      toast.error(financeErrorMessage(err, t));
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{t("finance.linkTitle", { ref: row.paymentRef })}</DialogTitle></DialogHeader>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>{row.refNo}</span><Money value={row.amount} className="font-semibold" /></div>
      <PickField label={t("finance.accountName")} nullable={false} value={accountId} onChange={setAccountId} options={(accounts ?? []).map((a) => ({ value: a.id, label: a.name }))} />
      <p className="text-xs text-muted-foreground">{t(row.kind === "credit" ? "finance.linkHintIn" : "finance.linkHintOut")}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!accountId || linkAccount.isPending}>{t("finance.linkAccount")}</Button>
      </DialogFooter>
    </form>
  );
}

export function PaymentAccountReport() {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: lookups } = useLookups();
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>(["account", "linked", "type", "location", "range"]);
  const [query, setQuery] = useTableQuery("payment-accounts");
  const [link, setLink] = useState<PaymentReportRow | null>(null);
  const range = decodeRange(url.range);
  const filters: PaymentReportFilters = {
    search: query.search || undefined, page: query.page, pageSize: query.pageSize, accountId: url.account, linked: url.linked as PaymentReportFilters["linked"],
    type: url.type, locationId: url.location, from: range?.from, to: range?.to,
  };
  const list = usePaymentReport(filters);

  const text = (id: keyof PaymentReportRow, label: string, render?: (r: PaymentReportRow) => string): ColumnDef<PaymentReportRow> => ({
    id, accessorKey: id, header: label, enableSorting: false, meta: { label, csv: render ? (r) => render(r) : undefined }, cell: ({ row }) => (render ? render(row.original) : String(row.original[id] ?? "")) || "—",
  });
  const columns: ColumnDef<PaymentReportRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), enableSorting: false, meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    text("paymentRef", t("finance.paymentRef")), text("refNo", t("finance.invoiceRef")),
    { id: "amount", accessorKey: "amount", header: t("finance.amount"), enableSorting: false, meta: { label: t("finance.amount"), align: "right" }, cell: ({ row }) => <Money value={row.original.kind === "credit" ? row.original.amount : -row.original.amount} /> },
    text("type", t("finance.paymentType"), (r) => t(`finance.txn.${r.type}`)),
    text("accountName", t("finance.accountName"), (r) => r.accountName || t("finance.unlinked")),
    text("description", t("finance.description")), text("locationName", t("common.location")),
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => (
      <RowActions items={[{ label: t(row.original.accountId ? "finance.changeAccount" : "finance.linkAccount"), icon: LinkIcon, onClick: () => setLink(row.original), hidden: !can("account.manage") }]} />
    ) },
  ];
  const defs: FilterDef[] = [
    { key: "account", label: t("finance.accountName"), type: "select", options: (lookups?.accounts ?? []).map((a) => ({ value: a.id, label: a.name })) },
    { key: "linked", label: t("finance.linkStatus"), type: "select", options: [{ value: "linked", label: t("finance.linked") }, { value: "unlinked", label: t("finance.unlinked") }] },
    { key: "type", label: t("finance.paymentType"), type: "select", options: TYPES.map((v) => ({ value: v, label: t(`finance.txn.${v}`) })) },
    { key: "location", label: t("common.location"), type: "select", options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];

  return (
    <>
      <PageHeader title={t("nav.paymentAccountReport")} description={t("finance.paymentReportDescription")} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { resetUrl(); setQuery({ page: 0 }); }} /></div>
      <DataTable
        tableId="payment-accounts" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery}
        exportName="payment-account-report" exportRows={() => accountsService.paymentReport({ ...filters, page: 0, pageSize: -1 }).then((r) => r.rows)}
        empty={<EmptyState icon={WalletIcon} title={t("finance.noPayments")} />}
      />
      <Dialog open={link !== null} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent className="sm:max-w-md">{link && <LinkBody row={link} onClose={() => setLink(null)} />}</DialogContent>
      </Dialog>
    </>
  );
}
