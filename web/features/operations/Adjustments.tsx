"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, PlusIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Field, NumInput, PickField, Section } from "@/features/catalog/formParts";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useAdjustment, useAdjustmentMutations, useAdjustments } from "@/lib/data/hooks/operations";
import type { AdjustmentRow } from "@/lib/data/services/adjustments";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { opsErrorMessage } from "./opsError";
import { ProductPicker, variationLabel } from "./ProductPicker";

const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`; };

function Detail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: a } = useAdjustment(id);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{a?.refNo}</DialogTitle></DialogHeader>
        {a && (
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">{`${a.locationName} · ${f.dateTime(a.date)} · ${t(`ops.adjType.${a.type}`)}`}</p>
            <Table>
              <TableHeader><TableRow><TableHead>{t("products.product")}</TableHead><TableHead className="text-right">{t("catalog.qty")}</TableHead><TableHead className="text-right">{t("catalog.unitCost")}</TableHead><TableHead className="text-right">{t("common.subtotal")}</TableHead></TableRow></TableHeader>
              <TableBody>{a.lines.map((l) => <TableRow key={l.id}><TableCell>{l.name}</TableCell><TableCell className="text-right tabular">{`${f.qty(l.qty)} ${l.unitName}`}</TableCell><TableCell className="text-right tabular">{f.amount(l.unitCost)}</TableCell><TableCell className="text-right tabular">{f.amount(l.subtotal)}</TableCell></TableRow>)}</TableBody>
            </Table>
            <div className="flex justify-between font-semibold"><span>{t("common.total")}</span><Money value={a.total} /></div>
            {a.type === "abnormal" && <div className="flex justify-between"><span>{t("ops.amountRecovered")}</span><Money value={a.recovered} /></div>}
            {a.reason && <p className="text-muted-foreground">{a.reason}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdjustmentsList() {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { remove } = useAdjustmentMutations();
  const [url, setUrl, reset] = useUrlFilters<{ location?: string; type?: string; range?: string }>(["location", "type", "range"]);
  const [query, setQuery] = useTableQuery("adjustments");
  const [del, setDel] = useState<AdjustmentRow | null>(null);
  const [view, setView] = useState<string | null>(null);
  const range = decodeRange(url.range);
  const list = useAdjustments({ search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort, locationId: url.location ?? (g === "all" ? undefined : g), type: url.type as "normal" | "abnormal" | undefined, from: range?.from, to: range?.to });
  const totals = list.data?.totals;
  const columns: ColumnDef<AdjustmentRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "refNo", accessorKey: "refNo", header: t("ops.refNo"), meta: { label: t("ops.refNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    { id: "locationName", accessorKey: "locationName", header: t("common.location"), meta: { label: t("common.location") } },
    { id: "type", accessorKey: "type", header: t("ops.adjType.label"), meta: { label: t("ops.adjType.label"), csv: (r) => t(`ops.adjType.${r.type}`) }, cell: ({ row }) => <Badge variant={row.original.type === "abnormal" ? "destructive" : "secondary"}>{t(`ops.adjType.${row.original.type}`)}</Badge> },
    { id: "total", accessorKey: "total", header: t("ops.totalAmount"), meta: { label: t("ops.totalAmount"), align: "right" }, cell: ({ row }) => <Money value={row.original.total} /> },
    { id: "recovered", accessorKey: "recovered", header: t("ops.amountRecovered"), meta: { label: t("ops.amountRecovered"), align: "right" }, cell: ({ row }) => <Money value={row.original.recovered} /> },
    { id: "reason", accessorKey: "reason", header: t("ops.reason"), meta: { label: t("ops.reason"), className: "max-w-60 truncate" }, cell: ({ row }) => row.original.reason || "—" },
    { id: "addedBy", accessorKey: "addedBy", header: t("sales.user"), meta: { label: t("sales.user") } },
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => (
      <RowActions items={[
        { label: t("common.view"), icon: EyeIcon, onClick: () => setView(row.original.id) },
        { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original), hidden: !can("stock_adjustment.delete") },
      ]} />) },
  ];
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) },
    { key: "type", label: t("ops.adjType.label"), type: "select", options: (["normal", "abnormal"] as const).map((v) => ({ value: v, label: t(`ops.adjType.${v}`) })) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];
  return (
    <>
      <PageHeader title={t("nav.stockAdjustments")} description={t("ops.adjustmentsDescription")} actions={can("stock_adjustment.create") && <Button asChild><Link href="/stock/adjustments/new"><PlusIcon />{t("ops.addAdjustment")}</Link></Button>} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} /></div>
      <DataTable tableId="adjustments" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="adjustments"
        onRowClick={(r) => setView(r.id)} empty={<EmptyState icon={SlidersHorizontalIcon} title={t("ops.noAdjustments")} />}
        footer={totals ? () => ({ refNo: t("sales.footerTotals"), total: <Money value={totals.total} />, recovered: <Money value={totals.recovered} /> }) : undefined} />
      <Detail id={view} onClose={() => setView(null)} />
      <ConfirmDialog open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} description={t("ops.deleteAdjustmentBody")} confirmLabel={t("common.delete")}
        onConfirm={async () => { if (!del) return; try { await remove.mutateAsync(del.id); toast.success(t("common.deleted")); } catch (e) { toast.error(opsErrorMessage(e, t)); } }} />
    </>
  );
}

type Row = { productId: string; variationId: string; qty: number; name: string; sku: string };

export function AdjustmentForm() {
  const t = useTranslations();
  const router = useRouter();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { create } = useAdjustmentMutations();
  const [pickedLocation, setLocationId] = useState(g === "all" ? "" : g);
  const locationId = pickedLocation || (lookups?.locations.find((l) => l.active)?.id ?? "");
  const [type, setType] = useState<"normal" | "abnormal">("normal");
  const [recovered, setRecovered] = useState(0);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(stamp());
  const [rows, setRows] = useState<Row[]>([]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await create.mutateAsync({ locationId, date, type, amountRecovered: recovered, reason, lines: rows.map(({ productId, variationId, qty }) => ({ productId, variationId, qty })) });
      toast.success(t("ops.adjustmentSaved", { refNo: r.refNo }));
      router.push("/stock/adjustments");
    } catch (err) {
      toast.error(opsErrorMessage(err, t));
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 pb-6">
      <PageHeader title={t("ops.addAdjustment")} description={t("ops.adjustmentFormDescription")} />
      <Section title={t("catalog.details")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PickField label={t("common.location")} nullable={false} value={locationId || null} onChange={(x) => setLocationId(x ?? "")} options={(lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} />
          <Field label={t("common.date")} htmlFor="ad-date"><Input id="ad-date" type="datetime-local" required value={date.slice(0, 16)} onChange={(e) => setDate(`${e.target.value}:00`)} /></Field>
          <PickField label={t("ops.adjType.label")} nullable={false} value={type} onChange={(x) => setType((x ?? "normal") as "normal" | "abnormal")} options={(["normal", "abnormal"] as const).map((v) => ({ value: v, label: t(`ops.adjType.${v}`) }))} />
          {type === "abnormal" && <Field label={t("ops.amountRecovered")}><NumInput label={t("ops.amountRecovered")} value={recovered} onChange={setRecovered} /></Field>}
        </div>
      </Section>
      <Section title={t("ops.items")}>
        <ProductPicker onPick={(p, v) => setRows((rs) => (rs.some((r) => r.variationId === v.id) ? rs : [...rs, { productId: p.id, variationId: v.id, qty: 1, name: variationLabel(p, v), sku: v.sku }]))} />
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("ops.noItems")}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("products.product")}</TableHead><TableHead className="w-32">{t("ops.qtyToRemove")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.variationId}>
                  <TableCell>{r.name} <span className="text-xs text-muted-foreground tabular">{r.sku}</span></TableCell>
                  <TableCell><NumInput label={`${r.name} ${t("ops.qtyToRemove")}`} value={r.qty} onChange={(n) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: n } : x)))} /></TableCell>
                  <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2Icon /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Field label={t("ops.reason")} htmlFor="ad-reason"><Textarea id="ad-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Section>
      <div className="flex justify-end gap-2">
        <Button asChild type="button" variant="ghost"><Link href="/stock/adjustments">{t("common.cancel")}</Link></Button>
        <Button type="submit" disabled={create.isPending || rows.length === 0 || !locationId}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
