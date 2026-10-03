"use client";

import { useState, type FormEvent } from "react";
import { PercentIcon, PlusIcon, PowerIcon, PowerOffIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useProducts } from "@/lib/data/hooks/products";
import { useDiscountMutations, useDiscounts } from "@/lib/data/hooks/sales";
import type { DiscountInputData, DiscountRow } from "@/lib/data/services/discounts";
import { useFormat } from "@/lib/i18n/format";
import { saleErrorMessage } from "./saleError";

const NONE = "none";
const today = () => new Date().toISOString().slice(0, 10);

function DiscountForm({ row, onClose }: { row: DiscountRow | null; onClose: () => void }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { save } = useDiscountMutations();
  const [term, setTerm] = useState("");
  const { data: all } = useProducts({ pageSize: -1 });
  const [v, setV] = useState<DiscountInputData & { id?: string }>(row ?? {
    name: "", locationId: null, productIds: [], brandId: null, categoryId: null, priority: 1, type: "percentage", amount: 0,
    startsAt: today(), endsAt: today(), priceGroupIds: [], applyInCustomerGroups: false, active: true,
  });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const names = new Map((all?.rows ?? []).map((p) => [p.id, p.name]));
  const found = (all?.rows ?? []).filter((p) => term && !v.productIds.includes(p.id) && p.name.toLowerCase().includes(term.toLowerCase())).slice(0, 8);
  const pick = (label: string, value: string | null, opts: { id: string; name: string }[], onChange: (id: string | null) => void) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value ?? NONE} onValueChange={(x) => onChange(x === NONE ? null : x)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={NONE}>—</SelectItem>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync(v);
      toast.success(t("sales.discountSaved"));
      onClose();
    } catch (err) {
      toast.error(saleErrorMessage(err, t));
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{row ? t("sales.editDiscount") : t("sales.newDiscount")}</DialogTitle></DialogHeader>
      <div className="grid gap-2"><Label htmlFor="d-name">{t("sales.discountName")}</Label><Input id="d-name" required value={v.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label>{t("sales.discountAmount")}</Label>
          <Input aria-label={t("sales.discountAmount")} type="number" min={0} step="any" value={v.amount} onChange={(e) => set({ amount: Number(e.target.value) })} className="tabular-nums" />
        </div>
        <div className="grid gap-2">
          <Label>&nbsp;</Label>
          <Select value={v.type} onValueChange={(x) => set({ type: x as "fixed" | "percentage" })}>
            <SelectTrigger aria-label={t("sales.discountAmount")} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="percentage">{t("sales.percentage")}</SelectItem><SelectItem value="fixed">{t("sales.fixed")}</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid gap-2"><Label htmlFor="d-pri">{t("sales.priority")}</Label><Input id="d-pri" type="number" min={0} value={v.priority} onChange={(e) => set({ priority: Number(e.target.value) })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label htmlFor="d-start">{t("sales.startsAt")}</Label><Input id="d-start" type="date" value={v.startsAt.slice(0, 10)} onChange={(e) => set({ startsAt: e.target.value })} /></div>
        <div className="grid gap-2"><Label htmlFor="d-end">{t("sales.endsAt")}</Label><Input id="d-end" type="date" value={v.endsAt.slice(0, 10)} onChange={(e) => set({ endsAt: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {pick(t("sales.brand"), v.brandId, lookups?.brands ?? [], (id) => set({ brandId: id }))}
        {pick(t("sales.category"), v.categoryId, lookups?.categories ?? [], (id) => set({ categoryId: id }))}
        {pick(t("common.location"), v.locationId, lookups?.locations ?? [], (id) => set({ locationId: id }))}
        <label className="flex items-end gap-2 pb-2 text-sm"><Switch checked={v.applyInCustomerGroups} onCheckedChange={(x) => set({ applyInCustomerGroups: x })} />{t("sales.customerGroups")}</label>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="d-prod">{t("sales.products")}</Label>
        <Input id="d-prod" placeholder={t("sales.searchProductsShort")} value={term} onChange={(e) => setTerm(e.target.value)} />
        {found.map((p) => (
          <button key={p.id} type="button" className="rounded-md px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { set({ productIds: [...v.productIds, p.id] }); setTerm(""); }}>{p.name}</button>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {v.productIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1">{names.get(id) ?? id}<button type="button" aria-label={t("common.remove")} onClick={() => set({ productIds: v.productIds.filter((x) => x !== id) })}><XIcon className="size-3" /></button></Badge>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={v.active} onCheckedChange={(x) => set({ active: x })} />{t("common.active")}</label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

export function DiscountsList() {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const [query, setQuery] = useTableQuery("sales-discounts");
  const list = useDiscounts({ search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort });
  const { setActive, remove } = useDiscountMutations();
  const [edit, setEdit] = useState<DiscountRow | "new" | null>(null);
  const [del, setDel] = useState<DiscountRow | null>(null);
  const canAdd = can("discount.create");
  const canEdit = can("discount.update");
  const canRemove = can("discount.delete");

  const text = (id: keyof DiscountRow, label: string): ColumnDef<DiscountRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const date = (id: "startsAt" | "endsAt", label: string): ColumnDef<DiscountRow> => ({ id, accessorKey: id, header: label, meta: { label, className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.date(row.original[id])}</span> });
  const toggle = async (rows: DiscountRow[], active: boolean) => {
    await setActive.mutateAsync({ ids: rows.map((r) => r.id), active });
    toast.success(t(active ? "sales.activated" : "sales.deactivated", { count: rows.length }));
  };
  const columns: ColumnDef<DiscountRow>[] = [
    { id: "name", accessorKey: "name", header: t("sales.discountName"), meta: { label: t("sales.discountName") }, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    date("startsAt", t("sales.startsAt")), date("endsAt", t("sales.endsAt")),
    { id: "amount", accessorKey: "amount", header: t("sales.discountAmount"), meta: { label: t("sales.discountAmount"), align: "right", csv: (r) => `${r.amount}${r.type === "percentage" ? "%" : ""}` }, cell: ({ row }) => <span className="tabular">{row.original.type === "percentage" ? `${f.number(row.original.amount)}%` : f.money(row.original.amount)}</span> },
    { id: "priority", accessorKey: "priority", header: t("sales.priority"), meta: { label: t("sales.priority"), align: "right" }, cell: ({ row }) => <span className="tabular">{f.number(row.original.priority)}</span> },
    { ...text("scope", t("sales.scope")), meta: { label: t("sales.scope"), className: "max-w-60 truncate" } },
    text("locationName", t("common.location")),
    { id: "active", accessorKey: "active", header: t("common.status"), meta: { label: t("common.status"), csv: (r) => (r.active ? t("common.active") : t("common.inactive")) }, cell: ({ row }) => <Badge variant={row.original.active ? "secondary" : "outline"}>{row.original.active ? t("common.active") : t("common.inactive")}</Badge> },
    { id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined }, cell: ({ row }) => (
      <RowActions items={[
        { label: t("common.edit"), icon: PencilIcon, onClick: () => setEdit(row.original), hidden: !canEdit },
        { label: row.original.active ? t("common.deactivate") : t("common.activate"), icon: row.original.active ? PowerOffIcon : PowerIcon, onClick: () => toggle([row.original], !row.original.active), hidden: !canEdit },
        { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original), hidden: !canRemove },
      ]} />) },
  ];
  return (
    <>
      <PageHeader title={t("nav.discounts")} description={t("sales.discountsDescription")} actions={canAdd && <Button onClick={() => setEdit("new")}><PlusIcon />{t("sales.newDiscount")}</Button>} />
      <DataTable tableId="sales-discounts" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="discounts" selectable={canEdit}
        bulkActions={(rows, clear) => (
          <>
            <Button variant="ghost" size="sm" onClick={async () => { await toggle(rows, false); clear(); }}><PowerOffIcon />{t("sales.deactivateSelected")}</Button>
            <Button variant="ghost" size="sm" onClick={async () => { await toggle(rows, true); clear(); }}><PowerIcon />{t("sales.activateSelected")}</Button>
          </>
        )}
        empty={<EmptyState icon={PercentIcon} title={t("sales.noDiscounts")} />} />
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">{edit !== null && <DiscountForm row={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}</DialogContent>
      </Dialog>
      <ConfirmDialog open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} confirmLabel={t("common.delete")}
        onConfirm={async () => { if (del) await remove.mutateAsync([del.id]); }} />
    </>
  );
}
