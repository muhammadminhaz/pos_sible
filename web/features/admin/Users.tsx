"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader, useAdmin } from "./AdminShell";
import { day } from "./api";
import { StatCard } from "./parts";

export function UsersPage() {
  const { businesses } = useAdmin();
  const [q, setQ] = useState("");
  const list = businesses ?? [];
  const rows = list.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));
  const total = list.reduce((s, b) => s + b.users, 0);
  const atLimit = list.filter((b) => b.maxUsers !== null && b.users >= b.maxUsers).length;

  return (
    <>
      <AdminHeader title="Users" description="How many people can sign in at each business. You see counts, never who they are." />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard loading={!businesses} label="User accounts" count={total} />
        <StatCard loading={!businesses} label="Average per business" value={list.length ? (total / list.length).toFixed(1) : "0"} />
        <StatCard loading={!businesses} label="Businesses at their limit" count={atLimit} hint="Candidates for an upgrade" />
      </section>
      <div className="relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search businesses" placeholder="Search businesses…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Package</TableHead>
              <TableHead className="w-64">User accounts</TableHead>
              <TableHead>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!businesses && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {businesses && rows.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No businesses match.</TableCell></TableRow>}
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.planLabel}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress value={b.maxUsers ? Math.min(100, (b.users / b.maxUsers) * 100) : 0} aria-label={`${b.name} user accounts`} className="flex-1" />
                    <span className="w-14 text-right text-sm tabular-nums">{b.users}{b.maxUsers !== null ? ` / ${b.maxUsers}` : ""}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{day(b.lastActiveAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
