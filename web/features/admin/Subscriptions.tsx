"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BanIcon, CreditCardIcon, ReceiptIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AdminHeader, useAdmin } from "./AdminShell";
import { day, priceText, STATE_LABEL, type Business } from "./api";
import { CurrencyPicker, inRange, sortAndPage, StateBadge } from "./parts";
import { ActivateForm, CancelDialog, PaymentsDialog } from "./SubscriptionDialogs";

type Url = { plan?: string; status?: string; free?: string; ends?: string };
const URL_KEYS = ["plan", "status", "free", "ends"] as const;
const SORTS: Record<string, (b: Business) => string | number> = {
  name: (b) => b.name.toLowerCase(), planLabel: (b) => b.planLabel.toLowerCase(), state: (b) => b.state, lastPaidAt: (b) => b.lastPaidAt ?? "", expiresAt: (b) => (b.free ? "9999" : (b.expiresAt ?? "")), price: (b) => (b.free ? 0 : b.price),
};

export function SubscriptionsPage() {
  const { plans, businesses, reload } = useAdmin();
  const [activating, setActivating] = useState<Business | null>(null);
  const [viewing, setViewing] = useState<Business | null>(null);
  const [cancelling, setCancelling] = useState<Business | null>(null);
  const list = businesses ?? [];
  const [url, setUrl, reset] = useUrlFilters<Url>([...URL_KEYS]);
  const [query, setQuery] = useTableQuery("admin-subscriptions");
  const term = query.search.trim().toLowerCase();
  const planIds = url.plan?.split(",");
  const states = url.status?.split(",");
  const ends = decodeRange(url.ends);
  const filtered = list.filter((b) => (!term || b.name.toLowerCase().includes(term)) && (!planIds || planIds.includes(b.plan)) && (!states || states.includes(b.state)) && (url.free !== "1" || b.free) && inRange(b.expiresAt, ends));
  const { sorted, page } = sortAndPage(filtered, query, SORTS);

  const col = (id: string, label: string, cell: ColumnDef<Business>["cell"], meta: ColumnDef<Business>["meta"] = {}): ColumnDef<Business> => ({ id, accessorFn: SORTS[id], header: label, cell, meta: { label, ...meta } });
  const columns: ColumnDef<Business>[] = [
    col("name", "Business", ({ row }) => <span className="font-medium">{row.original.name}</span>),
    col("planLabel", "Package", ({ row }) => {
      const b = row.original;
      return (
        <div className="grid gap-0.5">
          <span>{b.planLabel}{b.free && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-foreground">Free</span>}</span>
          {b.nextPlanLabel && <span className="text-xs text-muted-foreground">Then {b.nextPlanLabel}</span>}
        </div>
      );
    }, { csv: (b) => b.planLabel }),
    col("state", "Status", ({ row }) => <StateBadge state={row.original.state} />, { csv: (b) => STATE_LABEL[b.state] }),
    col("lastPaidAt", "Last paid", ({ row }) => <span className="whitespace-nowrap">{day(row.original.lastPaidAt)}</span>, { csv: (b) => day(b.lastPaidAt) }),
    col("expiresAt", "Ends", ({ row }) => <span className="whitespace-nowrap">{row.original.free ? "Never" : day(row.original.expiresAt)}</span>, { csv: (b) => (b.free ? "Never" : day(b.expiresAt)) }),
    col("price", "Price", ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.free ? "Free" : priceText(row.original)}</span>, { align: "right", csv: (b) => (b.free ? "Free" : priceText(b)) }),
    {
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => (
        <RowActions items={[
          { label: "Activate or change package", icon: RefreshCwIcon, onClick: () => setActivating(row.original) },
          { label: "Payments and proof", icon: ReceiptIcon, onClick: () => setViewing(row.original) },
          { label: "Cancel subscription", icon: BanIcon, destructive: true, onClick: () => setCancelling(row.original), hidden: row.original.state === "cancelled" },
        ]} />
      ),
    },
  ];
  const defs: FilterDef[] = [
    { key: "plan", label: "Package", type: "select", options: plans.map((p) => ({ value: p.id, label: p.label })) },
    { key: "status", label: "Status", type: "select", options: Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label })) },
    { key: "free", label: "Free accounts", type: "toggle" },
    { key: "ends", label: "Ends", type: "daterange" },
  ];

  const done = async (close: () => void) => { close(); await reload(); };

  return (
    <>
      <AdminHeader
        title="Subscriptions"
        description="A business only runs while you keep its subscription active. Packages are managed under Packages."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} />
        <CurrencyPicker />
      </div>
      <DataTable
        tableId="admin-subscriptions" columns={columns} data={page} total={sorted.length} loading={!businesses} query={query} onQueryChange={setQuery} exportName="subscriptions" audit={false} fill="26rem"
        exportRows={async () => sorted} getRowId={(b) => b.id}
        empty={<EmptyState icon={CreditCardIcon} title={list.length ? "No subscriptions match" : "No businesses yet"} description={list.length ? "Try a different search or clear the filters." : "Add one under Businesses, then activate its subscription here once it pays."} />}
      />

      <Dialog open={activating !== null} onOpenChange={(o) => !o && setActivating(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">{activating && <ActivateForm key={activating.id} business={activating} plans={plans} onClose={() => setActivating(null)} onDone={() => done(() => setActivating(null))} />}</DialogContent>
      </Dialog>
      <PaymentsDialog business={viewing} onClose={() => setViewing(null)} />
      <CancelDialog business={cancelling} onClose={() => setCancelling(null)} onDone={() => done(() => setCancelling(null))} />
    </>
  );
}
