"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";
import { TONE_SOFT, type Tone } from "./tones";

const TONES: Record<string, Tone> = {
  paid: "success", final: "success", received: "success", completed: "success", delivered: "success", active: "success",
  partial: "warning", pending: "warning", ordered: "warning", ordered_shipping: "warning", packed: "info",
  due: "danger", overdue: "danger", cancelled: "danger", inactive: "default",
  draft: "default", quotation: "info", proforma: "info", suspended: "warning",
  in_transit: "info", shipped: "info", open: "success", close: "default",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("status");
  const tone = TONES[status] ?? "default";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        TONE_SOFT[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {t.has(status) ? t(status) : status}
    </span>
  );
}
