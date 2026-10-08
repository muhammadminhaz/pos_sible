"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { UsersIcon } from "lucide-react";
import { DataTable, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Progress } from "@/components/ui/progress";
import { AdminHeader, useAdmin } from "./AdminShell";
import { day, type Business } from "./api";
import { inRange, sortAndPage, StatCard } from "./parts";

type Url = { plan?: string; limit?: string; active?: string };
const URL_KEYS = ["plan", "limit", "active"] as const;
const SORTS: Record<string, (b: Business) => string | number> = {
  name: (b) => b.name.toLowerCase(), planLabel: (b) => b.planLabel.toLowerCase(), users: (b) => b.users, lastActiveAt: (b) => b.lastActiveAt ?? "",
};
const atLimit = (b: Business) => b.maxUsers !== null && b.users >= b.maxUsers;

export function UsersPage() {
  const { businesses, plans } = useAdmin();
  const [url, setUrl, reset] = useUrlFilters<Url>([...URL_KEYS]);
  const [query, setQuery] = useTableQuery("admin-users");
  const list = businesses ?? [];
  const total = list.reduce((s, b) => s + b.users, 0);

  const term = query.search.trim().toLowerCase();
  const planIds = url.plan?.split(",");
  const active = decodeRange(url.active);
  const filtered = list.filter((b) => (!term || b.name.toLowerCase().includes(term)) && (!planIds || planIds.includes(b.plan)) && (url.limit !== "1" || atLimit(b)) && inRange(b.lastActiveAt, active));
  const { sorted, page } = sortAndPage(filtered, query, SORTS);

  const col = (id: string, label: string, cell: ColumnDef<Business>["cell"], meta: ColumnDef<Business>["meta"] = {}): ColumnDef<Business> => ({ id, accessorFn: SORTS[id], header: label, cell, meta: { label, ...meta } });
  const columns: ColumnDef<Business>[] = [
    col("name", "Business", ({ row }) => <span className="font-medium">{row.original.name}</span>),
    col("planLabel", "Package", ({ row }) => row.original.planLabel),
    col("users", "User accounts", ({ row }) => {
      const b = row.original;
      return b.maxUsers === null ? (
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium tabular-nums">{b.users}</span>
          <span className="text-xs text-muted-foreground">No limit</span>
        </div>
      ) : (
        <div className="flex w-64 items-center gap-3">
          <Progress value={Math.min(100, (b.users / b.maxUsers) * 100)} aria-label={`${b.name} user accounts`} className="flex-1" />
          <span className="w-14 text-right text-sm tabular-nums">{b.users} / {b.maxUsers}</span>
        </div>
      );
    }, { csv: (b) => (b.maxUsers === null ? `${b.users}` : `${b.users} / ${b.maxUsers}`) }),
    col("lastActiveAt", "Last active", ({ row }) => <span className="whitespace-nowrap">{day(row.original.lastActiveAt)}</span>, { csv: (b) => day(b.lastActiveAt) }),
  ];
  const defs: FilterDef[] = [
    { key: "plan", label: "Package", type: "select", options: plans.map((p) => ({ value: p.id, label: p.label })) },
    { key: "limit", label: "At user limit", type: "toggle" },
    { key: "active", label: "Last active", type: "daterange" },
  ];
  const filtering = list.length > 0;

  return (
    <>
      <AdminHeader title="Users" description="How many users each business has, against its package limit. You see counts, never who they are." />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard loading={!businesses} label="User accounts" count={total} />
        <StatCard loading={!businesses} label="Average per business" value={list.length ? (total / list.length).toFixed(1) : "0"} />
        <StatCard loading={!businesses} label="Businesses at their limit" count={list.filter(atLimit).length} hint="Candidates for an upgrade" />
      </section>
      <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} />
      <DataTable
        tableId="admin-users" columns={columns} data={page} total={sorted.length} loading={!businesses} query={query} onQueryChange={setQuery} exportName="users-per-business" audit={false} fill="32rem"
        exportRows={async () => sorted} getRowId={(b) => b.id}
        empty={<EmptyState icon={UsersIcon} title={filtering ? "No businesses match" : "No businesses yet"} description={filtering ? "Try a different search or clear the filters." : "User counts appear here once a business is added."} />}
      />
    </>
  );
}
