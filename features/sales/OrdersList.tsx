"use client";

import { useState } from "react";
import { ClipboardListIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Money } from "@/components/shared/Money";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosSearch } from "@/lib/data/hooks/pos";
import { useOrderMutations, useOrders } from "@/lib/data/hooks/sales";
import { SHIPPING_STATUSES } from "@/lib/data/schemas";
import type { OrderRow, OrderStatus } from "@/lib/data/services/orders";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { saleErrorMessage } from "./saleError";

type Url = { location?: string; customer?: string; status?: string; shipping?: string; range?: string };
const KEYS = ["location", "customer", "status", "shipping", "range"] as const;
const ship = (v: string) => (v === "ordered" ? "ordered_shipping" : v);

function NewOrder({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { data: customers } = useContacts({ type: "customer", active: "active", pageSize: -1 });
  const { create } = useOrderMutations();
  const g = useUI((s) => s.locationId);
  const [loc, setLoc] = useState(g !== "all" ? g : "");
  const [contactId, setContactId] = useState("");
  const [term, setTerm] = useState("");
  const [lines, setLines] = useState<{ productId: string; variationId: string; unitId: string; name: string; qty: string; unitPrice: number }[]>([]);
  const { data: hits = [] } = usePosSearch({ locationId: loc, term: loc ? term : "" });

  const submit = async () => {
    try {
      const r = await create.mutateAsync({ locationId: loc, contactId, lines: lines.map((l) => ({ productId: l.productId, variationId: l.variationId, unitId: l.unitId, qty: Number(l.qty), unitPrice: l.unitPrice })) });
      toast.success(t("sales.orderCreated", { refNo: r.refNo }));
      onClose();
    } catch (e) {
      toast.error(saleErrorMessage(e, t));
    }
  };
  const pick = (opts: { value: string; label: string }[], value: string, set: (v: string) => void, label: string) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={set}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
    </div>
  );
  return (
    <div className="grid gap-4">
      <DialogHeader><DialogTitle>{t("sales.newOrder")}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        {pick((lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })), loc, (v) => { setLoc(v); setLines([]); }, t("common.location"))}
        {pick((customers?.rows ?? []).filter((c) => !c.isDefault).map((c) => ({ value: c.id, label: c.name })), contactId, setContactId, t("sales.customer"))}
      </div>
      <div className="relative">
        <Input aria-label={t("sales.searchProducts")} placeholder={t("sales.searchProducts")} value={term} disabled={!loc} onChange={(e) => setTerm(e.target.value)} />
        {term && hits.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
            {hits.map((h) => (
              <li key={h.variation.id}>
                <button type="button" className="flex w-full justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => { setLines([...lines, { productId: h.product.id, variationId: h.variation.id, unitId: h.product.unitId, name: h.product.name, qty: "1", unitPrice: h.variation.unitPrice }]); setTerm(""); }}>
                  <span>{h.product.name} <span className="text-muted-foreground">{h.variation.sku}</span></span><Money value={h.variation.unitPrice} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {lines.map((l, i) => (
        <div key={l.variationId} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
          <Input aria-label={t("sales.qty")} type="number" min={0} step="any" className="w-24 tabular-nums" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2Icon /></Button>
        </div>
      ))}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button disabled={!loc || !contactId || !lines.length || create.isPending} onClick={submit}>{t("common.save")}</Button>
      </DialogFooter>
    </div>
  );
}

export function OrdersList() {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const g = useUI((s) => s.locationId);
  const { data: lookups } = useLookups();
  const { data: customers } = useContacts({ type: "customer", pageSize: -1 });
  const [url, setUrl, reset] = useUrlFilters<Url>([...KEYS]);
  const [query, setQuery] = useTableQuery("sales-orders");
  const [adding, setAdding] = useState(false);
  const range = decodeRange(url.range);
  const list = useOrders({ search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort, locationId: url.location ?? (g === "all" ? undefined : g), contactId: url.customer, status: url.status as OrderStatus | undefined, shippingStatus: url.shipping as never, from: range?.from, to: range?.to });

  const text = (id: keyof OrderRow, label: string): ColumnDef<OrderRow> => ({ id, accessorKey: id, header: label, meta: { label }, cell: ({ getValue }) => getValue<string>() || "—" });
  const columns: ColumnDef<OrderRow>[] = [
    { id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap" }, cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span> },
    { id: "refNo", accessorKey: "refNo", header: t("sales.orderNo"), meta: { label: t("sales.orderNo") }, cell: ({ row }) => <span className="font-medium tabular">{row.original.refNo}</span> },
    text("contactName", t("sales.customer")), text("mobile", t("sales.mobile")), text("locationName", t("common.location")),
    { id: "status", accessorKey: "status", header: t("sales.orderStatus"), meta: { label: t("sales.orderStatus"), csv: (r) => t(`status.${r.status}`) }, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "shippingStatus", accessorKey: "shippingStatus", header: t("sales.shippingStatus"), meta: { label: t("sales.shippingStatus"), csv: (r) => r.shippingStatus ?? "" }, cell: ({ row }) => (row.original.shippingStatus ? <StatusBadge status={ship(row.original.shippingStatus)} /> : "—") },
    { id: "remainingQty", accessorKey: "remainingQty", header: t("sales.qtyRemaining"), meta: { label: t("sales.qtyRemaining"), align: "right" }, cell: ({ row }) => <span className="tabular">{f.qty(row.original.remainingQty)}</span> },
    text("addedBy", t("sales.addedBy")),
  ];
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "customer", label: t("sales.customer"), type: "select", options: named(customers?.rows ?? []) },
    { key: "status", label: t("sales.orderStatus"), type: "select", options: (["ordered", "partial", "completed"] as const).map((v) => ({ value: v, label: t(`status.${v}`) })) },
    { key: "shipping", label: t("sales.shippingStatus"), type: "select", options: SHIPPING_STATUSES.map((v) => ({ value: v, label: t(`status.${ship(v)}`) })) },
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
  ];
  return (
    <>
      <PageHeader title={t("nav.salesOrders")} description={t("sales.ordersDescription")} actions={can("sell.create") && <Button onClick={() => setAdding(true)}><PlusIcon />{t("sales.newOrder")}</Button>} />
      <div className="mb-4"><FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} /></div>
      <DataTable tableId="sales-orders" columns={columns} data={list.data?.rows ?? []} total={list.data?.total ?? 0} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="sales-orders" empty={<EmptyState icon={ClipboardListIcon} title={t("sales.noOrders")} />} />
      <Dialog open={adding} onOpenChange={setAdding}><DialogContent className="sm:max-w-xl">{adding && <NewOrder onClose={() => setAdding(false)} />}</DialogContent></Dialog>
    </>
  );
}
