"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { crud } from "@/lib/data/services/catalog";
import { keys } from "./keys";

/** The four "who touched this" fields of a record. User ids; times are ISO strings. */
export type AuditInfo = { createdBy?: string | null; createdAt?: string | null; updatedBy?: string | null; updatedAt?: string | null };

/** List rows from a service carry `audit`; rows read straight from a table carry the fields themselves. */
export function auditOf(row: unknown): AuditInfo | null {
  if (!row || typeof row !== "object") return null;
  const r = row as { audit?: AuditInfo } & AuditInfo;
  const a = r.audit ?? r;
  return a.createdAt || a.createdBy || a.updatedAt || a.updatedBy ? a : null;
}

/** User id → full name, for showing who did something. */
export function useUserNames(enabled = true): (id: string | null | undefined) => string | null {
  const q = useQuery({ queryKey: [...keys.table("users").all, "names"], queryFn: () => crud("users").all(), enabled, staleTime: 30_000 });
  const names = useMemo(() => new Map((q.data ?? []).map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.username])), [q.data]);
  return (id) => (id ? (names.get(id) ?? null) : null);
}
