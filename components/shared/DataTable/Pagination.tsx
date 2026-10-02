"use client";

import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormat } from "@/lib/i18n/format";

const SIZES = [10, 25, 50, 100, -1];

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (q: { page?: number; pageSize?: number }) => void;
}) {
  const t = useTranslations();
  const f = useFormat();
  const all = pageSize === -1;
  const pages = all ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : all ? 1 : page * pageSize + 1;
  const to = all ? total : Math.min(total, (page + 1) * pageSize);

  return (
    <div data-print-hide className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px]">
      <span className="text-muted-foreground">
        {t("table.showing", { from: f.number(from), to: f.number(to), total: f.number(total) })}
      </span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="hidden text-muted-foreground sm:inline">{t("table.rowsPerPage")}</span>
          <Select value={String(pageSize)} onValueChange={(v) => onChange({ pageSize: Number(v), page: 0 })}>
            <SelectTrigger size="sm" className="w-20" aria-label={t("table.rowsPerPage")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s === -1 ? t("common.all") : f.number(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground tabular">
          {t("table.page", { page: f.number(page + 1), pages: f.number(pages) })}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => onChange({ page: 0 })} aria-label={t("table.firstPage")} className="hidden sm:inline-flex">
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => onChange({ page: page - 1 })} aria-label={t("common.previous")}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => onChange({ page: page + 1 })} aria-label={t("common.next")}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => onChange({ page: pages - 1 })} aria-label={t("table.lastPage")} className="hidden sm:inline-flex">
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
