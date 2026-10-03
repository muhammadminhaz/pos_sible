"use client";

import { useMemo } from "react";
import { useLookups } from "./lookups";

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
  const q = useLookups();
  const users = enabled ? q.data?.users : undefined;
  const names = useMemo(() => new Map((users ?? []).map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.username])), [users]);
  return (id) => (id ? (names.get(id) ?? null) : null);
}
