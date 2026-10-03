"use client";

import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Floating action bar shown while rows are selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  const t = useTranslations();
  if (count === 0) return null;
  return (
    <div
      data-print-hide
      role="toolbar"
      className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] animate-in items-center gap-2 rounded-xl border bg-popover p-1.5 pl-4 text-popover-foreground shadow-lg fade-in-0 slide-in-from-bottom-4"
    >
      <span className="text-sm font-medium whitespace-nowrap tabular">{t("common.selected", { count })}</span>
      <span className="mx-1 h-5 w-px bg-border" />
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label={t("table.clearSelection")}>
        <XIcon />
      </Button>
    </div>
  );
}
