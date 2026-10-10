"use client";

import {
  BanknoteIcon, CreditCardIcon, FileTextIcon, HandCoinsIcon, LayersIcon, PauseIcon, PencilLineIcon, SmartphoneIcon, XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { Location } from "@/lib/data/schemas";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { BKASH, NAGAD, methodLabel, tillMethods } from "@/lib/pos/methods";
import { usePosCommands } from "./usePosCommands";

/** The three tender buttons share one size so they read as a set; only the colour tells them apart. */
const PAY_BUTTON = "h-12 min-w-12 justify-center xl:min-w-32";

export function ActionBar({ location }: { location: Location }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const cmd = usePosCommands(location);
  if (!settings) return null;
  const p = settings.pos;
  const labels = settings.customLabels.payments;
  const methods = tillMethods(location.paymentMethods, labels);
  const off = cmd.empty || cmd.pending;

  // Below `sm` the bar wraps to two rows. Below `xl` (1280px) the bar has no room for icon + label on every button, so the label
  // hides and the icon plus `aria-label` carry the button; at `xl` and up the label returns.
  return (
    <footer className="flex h-16 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-t bg-card px-3 max-sm:h-auto max-sm:flex-wrap max-sm:pt-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* Phones: these secondary actions take the first row, tenders and the total the second. */}
      <div className="flex min-w-0 items-center gap-2 max-sm:w-full max-sm:overflow-x-auto">
      <Button variant="outline" onClick={cmd.quotation} disabled={off} aria-label={t("pos.actions.quotation")}>
        <FileTextIcon />
        <span className="hidden xl:inline">{t("pos.actions.quotation")}</span>
      </Button>
      {!p.disableDraft && (
        <Button variant="outline" onClick={cmd.draft} disabled={off} aria-label={t("pos.actions.draft")}>
          <PencilLineIcon />
          <span className="hidden xl:inline">{t("pos.actions.draft")}</span>
        </Button>
      )}
      {!p.disableSuspend && (
        <Button variant="outline" onClick={cmd.suspend} disabled={off} aria-label={t("pos.actions.suspend")}>
          <PauseIcon />
          <span className="hidden xl:inline">{t("pos.actions.suspend")}</span>
        </Button>
      )}
      {!p.disableCreditSaleButton && (
        <Button variant="outline" onClick={cmd.credit} disabled={off} aria-label={t("pos.actions.creditSale")}>
          <HandCoinsIcon />
          <span className="hidden xl:inline">{t("pos.actions.creditSale")}</span>
        </Button>
      )}
      {methods.includes("card") && (
        <Button variant="outline" onClick={() => cmd.pay("card")} disabled={off} aria-label={t("pos.actions.card")}>
          <CreditCardIcon />
          <span className="hidden xl:inline">{t("pos.actions.card")}</span>
        </Button>
      )}
      {!p.disableMultiplePay && (
        <Button variant="outline" onClick={() => cmd.pay("multiple")} disabled={off} aria-label={t("pos.actions.multiplePay")}>
          <LayersIcon />
          <span className="hidden xl:inline">{t("pos.actions.multiplePay")}</span>
        </Button>
      )}

      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 max-sm:w-full max-sm:justify-end">
        {methods.includes(BKASH) && (
          <Button
            size="lg"
            onClick={() => cmd.pay(BKASH)}
            disabled={off}
            aria-label={methodLabel(BKASH, t, labels)}
            className={cn(PAY_BUTTON, "bg-[#E2136E] text-white hover:bg-[#c5105f]")}
          >
            <SmartphoneIcon />
            <span className="hidden xl:inline">{methodLabel(BKASH, t, labels)}</span>
          </Button>
        )}
        {methods.includes(NAGAD) && (
          <Button
            size="lg"
            onClick={() => cmd.pay(NAGAD)}
            disabled={off}
            aria-label={methodLabel(NAGAD, t, labels)}
            className={cn(PAY_BUTTON, "bg-[#F6921E] text-neutral-950 hover:bg-[#dc8219]")}
          >
            <SmartphoneIcon />
            <span className="hidden xl:inline">{methodLabel(NAGAD, t, labels)}</span>
          </Button>
        )}
        <div className="shrink-0 px-3 text-right" aria-live="polite">
          <div className="text-xs text-muted-foreground">{t("pos.totals.payable")}</div>
          <div key={cmd.payable} className="pop text-2xl font-semibold tabular-nums">{f.money(cmd.payable)}</div>
        </div>
        {!p.disableExpressCheckout && (
          <Button
            size="lg"
            onClick={cmd.express}
            disabled={off}
            aria-label={t("pos.actions.cash")}
            className={cn(PAY_BUTTON, "bg-success text-white hover:bg-success/90 dark:text-background")}
          >
            <BanknoteIcon />
            <span className="hidden xl:inline">{t("pos.actions.cash")}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="lg"
          onClick={cmd.cancel}
          disabled={off}
          aria-label={t("pos.actions.cancel")}
          className="h-12 text-destructive hover:text-destructive"
        >
          <XIcon />
          <span className="hidden xl:inline">{t("pos.actions.cancel")}</span>
        </Button>
      </div>
    </footer>
  );
}
