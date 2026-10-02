"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, EyeIcon, PlusIcon, TruckIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Field, NumInput, PickField, Section } from "@/features/catalog/formParts";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useTransfer, useTransferMutations, useTransfers } from "@/lib/data/hooks/operations";
import type { TransferInput, TransferRow, TransferStatus } from "@/lib/data/services/transfers";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { opsErrorMessage } from "./opsError";
import { ProductPicker, variationLabel } from "./ProductPicker";

const STEPS: TransferStatus[] = ["pending", "in_transit", "completed"];
const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`; };

export function TransfersList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const { remove } = useTransferMutations();
  const [url, setUrl, reset] = useUrlFilters<{ from?: string; to?: string; status?: string; range?: string }>(["from", "to", "status", "range"]);
  const [query, setQuery] = useTableQuery("transfers");
  const [del, setDel] = useState<TransferRow | null>(null);
  const range = decodeRange(url.range);
  const list = useTransfers({ search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort, fromLocationId: url.from, toLocationId: url.to, status: url.status as TransferStatus | undefined, from: range?.from, to: range?.to });
  const columns: ColumnDef<TransferRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "refNo", accessorKey: "refNo", header: t("ops.refNo"), meta: { label: t("ops.refNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    { id: "fromName", accessorKey: "fromName", header: t("ops.fromLocation"), meta: { label: t("ops.fromLocation") } },
    { id: "toName", accessorKey: "toName", header: t("ops.toLocation"), meta: { label: t("ops.toLocation") } },
    { id: "status", accessorKey: "status", header: t("common.status"), meta: { label: t("common.status"), csv: (r) => t(`status.${r.status}`) }, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "itemsCount", accessorKey: "itemsCount", header: t("ops.itemsCount"), meta: { label: t("ops.itemsCount"), align: "right" }, cell: ({ row }) => <span className="tabular">{f.qty(row.original.itemsCount)}</span> },
    { id: "shipping", accessorKey: "shipping", header: t("ops.shippingCharges"), meta: { label: t("ops.shippingCharges"), align: "right" }, cell: ({ row }) => <Money value={row.original.shipping} /> },
    { id: "total", accessorKey: "total", header: t("common.total"), meta: { label: t("common.total"), align: "right" }, cell: ({ row }) => <Money value={row.original.total} /> },
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => (
      <RowActions items={[
        { label: t("common.view"), icon: EyeIcon, href: `/stock/transfers/${row.original.id}` },
        { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original), hidden: !can("stock_transfer.create") },
      ]} />) },
  ];
  const locs = (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name }));
  const defs: FilterDef[] = [
    { key: "from", label: t("ops.fromLocation"), type: "select", options: locs }, { key: "to", label: t("ops.toLocation"), type: "select", options: locs },
    { key: "status", label: t("common.status"), type: "select", options: STEPS.map((s) => ({ value: s, label: t(`status.${s}`) })) }, { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];
  return (
    <>
      <PageHeader title={t("nav.stockTransfers")} description={t("ops.transfersDescription")} actions={can("stock_transfer.create") && <Button asChild><Link href="/stock/transfers/new"><PlusIcon />{t("ops.addTransfer")}</Link></Button>} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} /></div>
      <DataTable tableId="transfers" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="transfers"
        onRowClick={(r) => router.push(`/stock/transfers/${r.id}`)} empty={<EmptyState icon={TruckIcon} title={t("ops.noTransfers")} />} />
      <ConfirmDialog open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} description={t("ops.deleteTransferBody")} confirmLabel={t("common.delete")}
        onConfirm={async () => { if (!del) return; try { await remove.mutateAsync(del.id); toast.success(t("common.deleted")); } catch (e) { toast.error(opsErrorMessage(e, t)); } }} />
    </>
  );
}

type Row = { productId: string; variationId: string; qty: number; name: string; sku: string };

export function TransferForm() {
  const t = useTranslations();
  const router = useRouter();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { create } = useTransferMutations();
  const [pickedFrom, setFrom] = useState(g === "all" ? "" : g);
  const [pickedTo, setTo] = useState("");
  // Start with sensible locations rather than two empty pickers.
  const activeLocations = lookups?.locations.filter((l) => l.active) ?? [];
  const from = pickedFrom || (activeLocations[0]?.id ?? "");
  const to = pickedTo || (activeLocations.find((l) => l.id !== from)?.id ?? "");
  const [status, setStatus] = useState<TransferStatus>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(stamp());
  const locs = (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input: TransferInput = { fromLocationId: from, toLocationId: to, date, status, shippingCharges: shipping, notes, lines: rows.map(({ productId, variationId, qty }) => ({ productId, variationId, qty })) };
    try {
      const r = await create.mutateAsync(input);
      toast.success(t("ops.transferSaved", { refNo: r.refNo }));
      router.push(`/stock/transfers/${r.id}`);
    } catch (err) {
      toast.error(opsErrorMessage(err, t));
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 pb-6">
      <PageHeader title={t("ops.addTransfer")} description={t("ops.transferFormDescription")} />
      <Section title={t("catalog.details")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PickField label={t("ops.fromLocation")} nullable={false} value={from || null} onChange={(x) => setFrom(x ?? "")} options={locs} />
          <PickField label={t("ops.toLocation")} nullable={false} value={to || null} onChange={(x) => setTo(x ?? "")} options={locs.filter((l) => l.value !== from)} />
          <Field label={t("common.date")} htmlFor="tr-date"><Input id="tr-date" type="datetime-local" required value={date.slice(0, 16)} onChange={(e) => setDate(`${e.target.value}:00`)} /></Field>
          <PickField label={t("common.status")} nullable={false} value={status} onChange={(x) => setStatus((x ?? "pending") as TransferStatus)} options={STEPS.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        </div>
      </Section>
      <Section title={t("ops.items")}>
        <ProductPicker onPick={(p, v) => setRows((rs) => (rs.some((r) => r.variationId === v.id) ? rs : [...rs, { productId: p.id, variationId: v.id, qty: 1, name: variationLabel(p, v), sku: v.sku }]))} />
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("ops.noItems")}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("products.product")}</TableHead><TableHead className="w-32">{t("catalog.qty")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.variationId}>
                  <TableCell>{r.name} <span className="text-xs text-muted-foreground tabular">{r.sku}</span></TableCell>
                  <TableCell><NumInput label={`${r.name} ${t("catalog.qty")}`} value={r.qty} onChange={(n) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: n } : x)))} /></TableCell>
                  <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2Icon /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section title={t("ops.charges")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("ops.shippingCharges")}><NumInput label={t("ops.shippingCharges")} value={shipping} onChange={setShipping} /></Field>
          <Field label={t("common.note")} htmlFor="tr-notes"><Textarea id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </Section>
      <div className="flex justify-end gap-2">
        <Button asChild type="button" variant="ghost"><Link href="/stock/transfers">{t("common.cancel")}</Link></Button>
        <Button type="submit" disabled={create.isPending || rows.length === 0 || !from || !to}>{t("common.save")}</Button>
      </div>
    </form>
  );
}

export function TransferDetail({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: tr, isError } = useTransfer(id);
  const { updateStatus } = useTransferMutations();
  if (isError) return <EmptyState title={t("errors.notFound")} />;
  if (!tr) return <Skeleton className="h-96" />;
  const at = STEPS.indexOf(tr.status as TransferStatus);
  const next = STEPS[at + 1];
  const advance = async () => {
    try { await updateStatus.mutateAsync({ id, status: next }); toast.success(t("ops.statusUpdated")); } catch (e) { toast.error(opsErrorMessage(e, t)); }
  };
  return (
    <div className="grid gap-4">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{tr.refNo}<StatusBadge status={tr.status} /></span>}
        description={<span className="inline-flex items-center gap-2">{tr.fromName}<ArrowRightIcon className="size-4" />{tr.toName} · {f.dateTime(tr.date)}</span>}
        actions={can("stock_transfer.create") && next && <Button onClick={advance} disabled={updateStatus.isPending}>{t(next === "in_transit" ? "ops.markInTransit" : "ops.markCompleted")}</Button>}
      />
      <ol className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`grid size-6 place-items-center rounded-full border text-xs ${i <= at ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{i < at || tr.status === "completed" ? <CheckIcon className="size-3.5" /> : f.number(i + 1)}</span>
            <span className={i <= at ? "font-medium" : "text-muted-foreground"}>{t(`status.${s}`)}</span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-border" />}
          </li>
        ))}
      </ol>
      <Section title={t("ops.items")}>
        <Table>
          <TableHeader><TableRow><TableHead>{t("products.product")}</TableHead><TableHead className="text-right">{t("catalog.qty")}</TableHead><TableHead className="text-right">{t("catalog.unitCost")}</TableHead><TableHead className="text-right">{t("common.subtotal")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {tr.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{tr.lineNames[l.id]?.name}<div className="text-xs text-muted-foreground tabular">{tr.lineNames[l.id]?.sku}</div></TableCell>
                <TableCell className="text-right tabular">{`${f.qty(l.qty)} ${tr.lineNames[l.id]?.unitName ?? ""}`}</TableCell>
                <TableCell className="text-right tabular">{f.amount(l.unitCost)}</TableCell>
                <TableCell className="text-right tabular">{f.amount(l.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className="ml-auto grid gap-1 text-sm">
          <div className="flex justify-between gap-8"><dt className="text-muted-foreground">{t("ops.shippingCharges")}</dt><dd className="tabular">{f.amount(tr.totals.shipping)}</dd></div>
          <div className="flex justify-between gap-8 font-semibold"><dt>{t("common.total")}</dt><dd><Money value={tr.totals.total} /></dd></div>
        </dl>
        {tr.notes && <p className="text-sm text-muted-foreground">{tr.notes}</p>}
      </Section>
    </div>
  );
}
