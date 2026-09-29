"use client";

import {
  BanknoteIcon, CreditCardIcon, FileTextIcon, HandCoinsIcon, LayersIcon, PauseIcon, PencilLineIcon, SmartphoneIcon, XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Location } from "@/lib/data/schemas";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { BKASH, NAGAD, methodLabel, tillMethods } from "@/lib/pos/methods";
import { usePosCommands } from "./usePosCommands";

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

  return (
    <footer className="flex h-16 shrink-0 items-center gap-2 border-t bg-card px-3">
      <Button variant="outline" onClick={cmd.quotation} disabled={off}>
        <FileTextIcon />
        {t("pos.actions.quotation")}
      </Button>
      {!p.disableDraft && (
        <Button variant="outline" onClick={cmd.draft} disabled={off}>
          <PencilLineIcon />
          {t("pos.actions.draft")}
        </Button>
      )}
      {!p.disableSuspend && (
        <Button variant="outline" onClick={cmd.suspend} disabled={off}>
          <PauseIcon />
          {t("pos.actions.suspend")}
        </Button>
      )}
      {!p.disableCreditSaleButton && (
        <Button variant="outline" onClick={cmd.credit} disabled={off}>
          <HandCoinsIcon />
          {t("pos.actions.creditSale")}
        </Button>
      )}
      {methods.includes("card") && (
        <Button variant="outline" onClick={() => cmd.pay("card")} disabled={off}>
          <CreditCardIcon />
          {t("pos.actions.card")}
        </Button>
      )}
      {!p.disableMultiplePay && (
        <Button variant="outline" onClick={() => cmd.pay("multiple")} disabled={off}>
          <LayersIcon />
          {t("pos.actions.multiplePay")}
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {methods.includes(BKASH) && (
          <Button onClick={() => cmd.pay(BKASH)} disabled={off} className="bg-[#E2136E] text-white hover:bg-[#c5105f]">
            <SmartphoneIcon />
            {methodLabel(BKASH, t, labels)}
          </Button>
        )}
        {methods.includes(NAGAD) && (
          <Button onClick={() => cmd.pay(NAGAD)} disabled={off} className="bg-[#F6921E] text-white hover:bg-[#dc8219]">
            <SmartphoneIcon />
            {methodLabel(NAGAD, t, labels)}
          </Button>
        )}
        <div className="px-3 text-right" aria-live="polite">
          <div className="text-xs text-muted-foreground">{t("pos.totals.payable")}</div>
          <div className="text-2xl font-semibold tabular-nums">{f.money(cmd.payable)}</div>
        </div>
        {!p.disableExpressCheckout && (
          <Button size="lg" onClick={cmd.express} disabled={off} className="h-12 min-w-32 bg-success text-success-foreground hover:bg-success/90">
            <BanknoteIcon />
            {t("pos.actions.cash")}
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={cmd.cancel} disabled={off} className="h-12 text-destructive hover:text-destructive">
          <XIcon />
          {t("pos.actions.cancel")}
        </Button>
      </div>
    </footer>
  );
}
