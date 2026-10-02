"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon, ClockIcon, HistoryIcon, KeyboardIcon, LockIcon, MapPinIcon, PauseCircleIcon, ReceiptIcon,
  Undo2Icon, WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator } from "@/components/layout/Calculator";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { LogoMark } from "@/components/layout/LogoMark";
import { ProfitPopover } from "@/components/layout/ProfitPopover";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useCan } from "@/lib/auth/useCan";
import type { CashRegister, Location } from "@/lib/data/schemas";
import { usePosSales } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { usePosDialogs } from "./dialogStore";

function Clock() {
  const f = useFormat();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums" suppressHydrationWarning>
      <ClockIcon className="size-4" />
      {f.dateTime(now)}
    </span>
  );
}

function IconAction({ label, onClick, disabled, badge, children }: {
  label: string; onClick?: () => void; disabled?: boolean; badge?: number; children: ReactNode;
}) {
  const f = useFormat();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled} className="relative">
          {children}
          {!!badge && (
            <span className="absolute -top-2.5 -right-1.5 pointer-coarse:-top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs leading-none font-semibold text-primary-foreground ring-2 ring-card tabular-nums">
              {f.number(badge)}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ location, allowed, register }: {
  location: Location | undefined; allowed: Location[]; register: CashRegister | null;
}) {
  const t = useTranslations();
  const can = useCan();
  const { data: settings } = useSettings();
  const setLocationId = useUI((s) => s.setLocationId);
  const show = usePosDialogs((s) => s.show);
  const suspended = usePosSales({ locationId: location?.id ?? "", status: "suspended", limit: 50 }, !!location && !!register);
  const locked = !register;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3">
      <Button variant="ghost" size="icon" asChild aria-label={t("common.back")}>
        <Link href="/home">
          <ArrowLeftIcon />
        </Link>
      </Button>
      <LogoMark />
      <Select value={location?.id ?? ""} onValueChange={setLocationId}>
        <SelectTrigger className="w-52" aria-label={t("pos.top.location")}>
          <MapPinIcon className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {allowed.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Clock />
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => show("shortcuts")}>
        <KeyboardIcon />
        {t("pos.top.shortcuts")}
        <kbd className="rounded border bg-muted px-1 text-xs">?</kbd>
      </Button>

      <div className="ml-auto flex items-center gap-0.5">
        {!settings?.pos.disableSuspend && (
          <IconAction label={t("pos.top.suspended")} onClick={() => show("suspended")} disabled={locked} badge={suspended.data?.length}>
            <PauseCircleIcon />
          </IconAction>
        )}
        {!settings?.pos.hideRecentTransactions && (
          <IconAction label={t("pos.top.recent")} onClick={() => show("recent")} disabled={locked}>
            <HistoryIcon />
          </IconAction>
        )}
        <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
        {can("expense.create") && (
          <IconAction label={t("pos.top.addExpense")} onClick={() => show("expense")} disabled={locked}>
            <WalletIcon />
          </IconAction>
        )}
        <IconAction label={t("pos.top.registerDetails")} onClick={() => show("registerDetails")} disabled={locked}>
          <ReceiptIcon />
        </IconAction>
        {can("cash_register.close") && (
          <IconAction label={t("pos.top.closeRegister")} onClick={() => show("registerClose")} disabled={locked}>
            <LockIcon />
          </IconAction>
        )}
        <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
        <Calculator />
        <ProfitPopover />
        {can("sell_return.view") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild aria-label={t("pos.top.sellReturn")}>
                <Link href="/sales/returns/new">
                  <Undo2Icon />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("pos.top.sellReturn")}</TooltipContent>
          </Tooltip>
        )}
        <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
        <LocaleToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
