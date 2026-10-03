"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, Trash2Icon, Undo2Icon, EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Field, PickField, Section } from "@/features/catalog/formParts";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePurchaseReturnLines, usePurchaseReturnMutations, usePurchaseReturns, usePurchases } from "@/lib/data/hooks/operations";
import type { PurchaseReturnRow } from "@/lib/data/services/purchaseReturns";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { opsErrorMessage } from "./opsError";

type Url = { location?: string; supplier?: string; range?: string };

export function PurchaseReturnsList() {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { data: suppliers } = useContacts({ type: "supplier", pageSize: -1 });
  const { remove } = usePurchaseReturnMutations();
  const [url, setUrl, reset] = useUrlFilters<Url>(["location", "supplier", "range"]);
  const [query, setQuery] = useTableQuery("purchase-returns");
  const [del, setDel] = useState<PurchaseReturnRow | null>(null);
  const range = decodeRange(url.range);
  const list = usePurchaseReturns({ search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort, locationId: url.location ?? (g === "all" ? undefined : g), contactId: url.supplier, from: range?.from, to: range?.to });
  const text = (id: keyof PurchaseReturnRow, label: string): ColumnDef<PurchaseReturnRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const columns: ColumnDef<PurchaseReturnRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "refNo", accessorKey: "refNo", header: t("ops.refNo"), meta: { label: t("ops.refNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    { id: "parentRef", accessorKey: "parentRef", header: t("ops.parentPurchase"), meta: { label: t("ops.parentPurchase") }, cell: ({ row }) => (row.original.parentId ? <Link className="text-primary hover:underline" href={`/purchases/${row.original.parentId}`}>{row.original.parentRef}</Link> : "—") },
    text("supplierName", t("ops.supplier")), text("locationName", t("common.location")),
    { id: "paymentStatus", accessorKey: "paymentStatus", header: t("sales.paymentStatus"), meta: { label: t("sales.paymentStatus"), csv: (r) => t(`status.${r.paymentStatus}`) }, cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
    { id: "total", accessorKey: "total", header: t("common.total"), meta: { label: t("common.total"), align: "right" }, cell: ({ row }) => <Money value={row.original.total} /> },
    { id: "due", accessorKey: "due", header: t("status.due"), meta: { label: t("status.due"), align: "right" }, cell: ({ row }) => <Money value={row.original.due} /> },
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => (
      <RowActions items={[{ label: t("ops.viewParentPurchase"), icon: EyeIcon, href: `/purchases/${row.original.parentId}`, hidden: !row.original.parentId }, { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original), hidden: !can("purchase.delete") }]} />) },
  ];
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "supplier", label: t("ops.supplier"), type: "select", options: named(suppliers?.rows ?? []) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];
  return (
    <>
      <PageHeader title={t("nav.purchaseReturns")} description={t("ops.returnsDescription")} actions={can("purchase.update") && <Button asChild><Link href="/purchases/returns/new"><PlusIcon />{t("nav.addPurchaseReturn")}</Link></Button>} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} /></div>
      <DataTable tableId="purchase-returns" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="purchase-returns"
        empty={<EmptyState icon={Undo2Icon} title={t("ops.noReturns")} />} />
      <ConfirmDialog open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} description={t("ops.deleteReturnBody")} confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!del) return;
          try { await remove.mutateAsync(del.id); toast.success(t("common.deleted")); } catch (e) { toast.error(opsErrorMessage(e, t)); }
        }} />
    </>
  );
}

export function PurchaseReturnForm() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const [purchaseId, setPurchaseId] = useState(useSearchParams().get("purchase") ?? "");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const { data: purchases } = usePurchases({ status: "received", pageSize: -1, sort: { id: "date", desc: true } });
  const { data: lines } = usePurchaseReturnLines(purchaseId || undefined);
  const { create } = usePurchaseReturnMutations();
  const picked = (lines ?? []).map((l) => ({ ...l, ret: Number(qty[l.lineId]) || 0 })).filter((l) => l.ret > 0);
  const total = picked.reduce((s, l) => s + l.ret * l.unitPrice, 0);
  const submit = async () => {
    try {
      const r = await create.mutateAsync({ parentId: purchaseId, lines: picked.map((l) => ({ lineId: l.lineId, qty: l.ret })), note });
      toast.success(t("ops.returnSaved", { refNo: r.refNo }));
      router.push("/purchases/returns");
    } catch (e) {
      toast.error(opsErrorMessage(e, t));
    }
  };
  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title={t("nav.addPurchaseReturn")} description={t("ops.returnFormDescription")} />
      <Section title={t("ops.parentPurchase")}>
        <PickField label={t("ops.chooseReference")} nullable={false} value={purchaseId || null} onChange={(x) => { setPurchaseId(x ?? ""); setQty({}); }}
          options={(purchases?.rows ?? []).map((p) => ({ value: p.id, label: `${p.refNo} · ${p.supplierName} · ${f.money(p.total)}` }))} />
      </Section>
      {lines && (
        <Section title={t("ops.items")}>
          <Table>
            <TableHeader><TableRow><TableHead>{t("products.product")}</TableHead><TableHead className="text-right">{t("ops.bought")}</TableHead><TableHead className="text-right">{t("ops.returned")}</TableHead><TableHead className="text-right">{t("ops.inStock")}</TableHead><TableHead className="text-right">{t("ops.unitCostExc")}</TableHead><TableHead className="w-32">{t("ops.returnQty")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l) => {
                const max = Math.min(l.boughtQty - l.returnedQty, l.inStock ?? Infinity);
                return (
                  <TableRow key={l.lineId}>
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="text-right tabular">{f.qty(l.boughtQty)}</TableCell>
                    <TableCell className="text-right tabular">{f.qty(l.returnedQty)}</TableCell>
                    <TableCell className="text-right tabular">{l.inStock == null ? "—" : f.qty(l.inStock)}</TableCell>
                    <TableCell className="text-right tabular">{f.amount(l.unitPrice)}</TableCell>
                    <TableCell><Input aria-label={`${l.name} ${t("ops.returnQty")}`} type="number" min={0} max={Number.isFinite(max) ? max : undefined} step="any" value={qty[l.lineId] ?? ""} onChange={(e) => setQty({ ...qty, [l.lineId]: e.target.value })} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Field label={t("common.note")} htmlFor="pr-note"><Textarea id="pr-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("common.total")}: <Money value={total} className="font-semibold" /></span>
            <Button disabled={picked.length === 0 || create.isPending} onClick={submit}>{t("common.save")}</Button>
          </div>
        </Section>
      )}
    </div>
  );
}
