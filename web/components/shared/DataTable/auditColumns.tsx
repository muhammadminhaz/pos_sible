"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { auditOf, useUserNames, type AuditInfo } from "@/lib/data/hooks/audit";
import { useFormat } from "@/lib/i18n/format";

export const AUDIT_COLUMN_IDS = ["audit_createdBy", "audit_createdAt", "audit_updatedBy", "audit_updatedAt"] as const;

/** Name, or an em dash when the record has none (seed data, imports before sign-in existed). */
export function WhoCell({ id }: { id: string | null | undefined }) {
  const t = useTranslations("audit");
  const name = useUserNames();
  if (!id) return <span className="text-muted-foreground">—</span>;
  return <span>{name(id) ?? t("removedUser")}</span>;
}

/**
 * Created by / created at / updated by / updated at, for any table whose rows carry them. Hidden until the user
 * turns them on in the Columns menu, so tables stay as compact as before.
 */
export function useAuditColumns<T>(rows: T[]): ColumnDef<T, unknown>[] {
  const t = useTranslations("audit");
  const fmt = useFormat();
  const names = useUserNames(rows.some((r) => auditOf(r)));
  if (!rows.some((r) => auditOf(r))) return [];
  const get = (r: T): AuditInfo => auditOf(r) ?? {};
  const who = (key: "createdBy" | "updatedBy"): ColumnDef<T, unknown> => ({
    id: `audit_${key}`,
    header: t(key),
    enableSorting: false,
    meta: { label: t(key), csv: (r: T) => names(get(r)[key]) ?? "" },
    cell: ({ row }) => <WhoCell id={get(row.original)[key]} />,
  });
  const when = (key: "createdAt" | "updatedAt"): ColumnDef<T, unknown> => ({
    id: `audit_${key}`,
    header: t(key),
    enableSorting: false,
    meta: { label: t(key), csv: (r: T) => get(r)[key] ?? "" },
    cell: ({ row }) => {
      const v = get(row.original)[key];
      return v ? <span className="whitespace-nowrap">{fmt.dateTime(v)}</span> : <span className="text-muted-foreground">—</span>;
    },
  });
  return [who("createdBy"), when("createdAt"), who("updatedBy"), when("updatedAt")];
}
