"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ImageIcon, ReceiptIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdmin } from "./AdminShell";
import { call, day, formatMoney, termText, type HistoryEntry } from "./api";
import { CurrencyPicker, inRange, sortAndPage } from "./parts";

const KIND = {
  activation: { label: "Activated", className: "border-transparent bg-success-soft text-success-foreground" },
  cancellation: { label: "Cancelled", className: "border-transparent bg-danger-soft text-danger-foreground" },
} as const;

type Url = { kind?: string; on?: string; proof?: string };
const URL_KEYS = ["kind", "on", "proof"] as const;
const SORTS: Record<string, (h: HistoryEntry) => string | number> = {
  at: (h) => h.at, businessName: (h) => h.businessName.toLowerCase(), kind: (h) => h.kind, planLabel: (h) => h.planLabel.toLowerCase(), terms: (h) => h.terms ?? 0, amount: (h) => h.amount, reference: (h) => h.reference ?? "",
};

/** Every activation with the payment it recorded, and every cancellation, across all businesses. */
export function SubscriptionsPage() {
  const { me } = useAdmin();
  // null while loading, undefined when the request failed.
  const [history, setHistory] = useState<HistoryEntry[] | null | undefined>(null);
  const [proof, setProof] = useState<HistoryEntry | null>(null);
  const [url, setUrl, reset] = useUrlFilters<Url>([...URL_KEYS]);
  const [query, setQuery] = useTableQuery("admin-subscriptions");

  const [attempt, setAttempt] = useState(0);
  // Amounts come back in the console currency, so a currency change loads them again.
  useEffect(() => {
    let live = true;
    call("subscriptions").then(async (res) => { if (live) setHistory(res.ok ? (await res.json()).history : undefined); }).catch(() => live && setHistory(undefined));
    return () => { live = false; };
  }, [attempt, me.currency]);
  const retry = () => { setHistory(null); setAttempt((n) => n + 1); };

  const list = history ?? [];
  const term = query.search.trim().toLowerCase();
  const kinds = url.kind?.split(",");
  const on = decodeRange(url.on);
  const filtered = list.filter((h) =>
    (!term || h.businessName.toLowerCase().includes(term) || (h.reference ?? "").toLowerCase().includes(term) || h.planLabel.toLowerCase().includes(term)) &&
    (!kinds || kinds.includes(h.kind)) && (url.proof !== "1" || h.hasProof) && inRange(h.at, on));
  const { sorted, page } = sortAndPage(filtered, query.sort ? query : { ...query, sort: { id: "at", desc: true } }, SORTS);

  const col = (id: string, label: string, cell: ColumnDef<HistoryEntry>["cell"], meta: ColumnDef<HistoryEntry>["meta"] = {}): ColumnDef<HistoryEntry> => ({ id, accessorFn: SORTS[id], header: label, cell, meta: { label, ...meta } });
  const columns: ColumnDef<HistoryEntry>[] = [
    col("at", "Date", ({ row }) => <span className="whitespace-nowrap">{day(row.original.at)}</span>, { csv: (h) => day(h.at) }),
    col("businessName", "Business", ({ row }) => <span className="font-medium">{row.original.businessName}</span>, { csv: (h) => h.businessName }),
    col("kind", "Event", ({ row }) => <Badge variant="outline" className={KIND[row.original.kind].className}>{KIND[row.original.kind].label}</Badge>, { csv: (h) => KIND[h.kind].label }),
    col("planLabel", "Package", ({ row }) => <span className="whitespace-nowrap">{row.original.planLabel}</span>, { csv: (h) => h.planLabel }),
    col("terms", "Terms", ({ row }) => {
      const h = row.original;
      return <span className="whitespace-nowrap text-muted-foreground">{h.terms && h.periodUnit && h.periodCount ? `${h.terms} × ${termText(h.periodUnit, h.periodCount)}` : "—"}</span>;
    }, { csv: (h) => (h.terms && h.periodUnit && h.periodCount ? `${h.terms} x ${termText(h.periodUnit, h.periodCount)}` : "") }),
    col("amount", "Amount", ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.kind === "activation" ? formatMoney(row.original.amount) : "—"}</span>, { align: "right", csv: (h) => (h.kind === "activation" ? h.amount : "") }),
    col("reference", "Transaction ID", ({ row }) => row.original.reference ? <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{row.original.reference}</code> : <span className="text-muted-foreground">—</span>, { csv: (h) => h.reference ?? "" }),
    {
      id: "proof", header: "Proof", enableSorting: false, meta: { label: "Proof", csv: (h) => (h.hasProof ? "Yes" : "") },
      cell: ({ row }) => row.original.hasProof
        ? <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setProof(row.original)}><ImageIcon />View</Button>
        : <span className="text-muted-foreground">—</span>,
    },
  ];
  const defs: FilterDef[] = [
    { key: "kind", label: "Event", type: "select", options: Object.entries(KIND).map(([value, k]) => ({ value, label: k.label })) },
    { key: "on", label: "Date", type: "daterange" },
    { key: "proof", label: "With proof image", type: "toggle" },
  ];

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Every activation with its payment, and every cancellation. Manage subscriptions from Businesses."
        actions={<CurrencyPicker />}
      />
      <div className="mb-4">
        <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} />
      </div>
      <DataTable
        tableId="admin-subscriptions" columns={columns} data={page} total={sorted.length} loading={history === null} query={query} onQueryChange={setQuery} exportName="subscription-history" audit={false} fill="22rem"
        exportRows={async () => sorted} getRowId={(h) => h.id}
        empty={history === undefined
          ? <EmptyState icon={RefreshCwIcon} title="We couldn't load the history" description="Your records are safe. Check the connection and try again." action={<Button variant="outline" onClick={retry}>Try again</Button>} />
          : <EmptyState icon={ReceiptIcon} title={list.length ? "Nothing matches" : "No subscription history yet"} description={list.length ? "Try a different search or clear the filters." : "Activations and cancellations show up here once you activate a business under Businesses."} />}
      />

      <Dialog open={proof !== null} onOpenChange={(o) => !o && setProof(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          {proof && (
            <>
              <DialogHeader>
                <DialogTitle>Payment proof</DialogTitle>
                <DialogDescription>{proof.businessName}, {day(proof.at)}, {formatMoney(proof.amount)}{proof.reference ? `, transaction ${proof.reference}` : ""}</DialogDescription>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated admin-only image, served by the API */}
              <img src={`/api/admin/payments/${proof.paymentId}/proof`} alt={`Payment proof from ${proof.businessName} on ${day(proof.at)}`} className="max-h-[70dvh] w-auto max-w-full rounded-lg border" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
