"use client";

import { useTranslations } from "next-intl";
import { auditOf } from "@/lib/data/hooks/audit";
import { useFormat } from "@/lib/i18n/format";
import { WhoCell } from "./DataTable/auditColumns";

/** "Created by … · when / Updated by … · when" for one record, in the same words as the table columns. */
export function AuditFooter({ record }: { record: unknown }) {
  const t = useTranslations("audit");
  const f = useFormat();
  const a = auditOf(record);
  if (!a) return null;
  const line = (label: string, who: string | null | undefined, at: string | null | undefined) =>
    (who || at) && (
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-end"><WhoCell id={who} />{at ? <span className="text-muted-foreground"> · {f.dateTime(at)}</span> : null}</dd>
      </div>
    );
  return (
    <dl aria-label={t("title")} className="grid gap-1 rounded-xl border bg-card p-4 text-xs">
      {line(t("createdBy"), a.createdBy, a.createdAt)}
      {line(t("updatedBy"), a.updatedBy, a.updatedAt)}
    </dl>
  );
}
