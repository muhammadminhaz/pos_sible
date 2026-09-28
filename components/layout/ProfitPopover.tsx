"use client";

import { TrendingUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/lib/auth/useCan";
import { useProfitSummary } from "@/lib/data/hooks/dashboard";
import { useUI } from "@/lib/data/store/ui";
import { todayISO } from "@/lib/dates";
import { useFormat } from "@/lib/i18n/format";

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" | "danger" }) {
  return (
    <div className={cn("flex items-center justify-between py-1.5", strong && "border-t pt-2.5 font-semibold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className={cn("tabular", tone === "success" && "text-success", tone === "danger" && "text-danger")}>{value}</span>
    </div>
  );
}

function ProfitBody() {
  const t = useTranslations("header");
  const f = useFormat();
  const locationId = useUI((s) => s.locationId);
  const today = todayISO();
  const { data } = useProfitSummary({ locationId, from: today, to: today });

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold">{t("todaysProfit")}</h3>
        <span className="text-xs text-muted-foreground">{f.dateLong(today)}</span>
      </div>
      {data ? (
        <div className="text-sm">
          <Row label={t("sales")} value={f.money(data.sales)} />
          <Row label={t("cost")} value={f.money(data.cost)} />
          <Row label={t("expenses")} value={f.money(data.expense)} />
          <Row
            label={t("profit")}
            value={f.money(data.netProfit)}
            strong
            tone={data.netProfit >= 0 ? "success" : "danger"}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 py-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      )}
    </>
  );
}

export function ProfitPopover() {
  const t = useTranslations("header");
  const can = useCan();
  if (!can("report.profit_loss") && !can("report.view")) return null;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("todaysProfit")}>
              <TrendingUpIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("todaysProfit")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72">
        <ProfitBody />
      </PopoverContent>
    </Popover>
  );
}
