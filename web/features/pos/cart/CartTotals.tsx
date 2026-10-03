"use client";

import type { ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { WALK_IN_ID } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs, type PosDialog } from "../dialogStore";
import { usePosTotals } from "../usePos";

export function CartTotals({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.totals");
  const f = useFormat();
  const { cart } = useCart(locationId);
  const totals = usePosTotals(locationId);
  const { data: settings } = useSettings();
  const show = usePosDialogs((s) => s.show);
  if (!totals || !settings) return null;

  const edit = (what: string, dialog: PosDialog) => (
    <Button variant="ghost" size="icon-xs" aria-label={t("edit", { what })} onClick={() => show(dialog)} disabled={!cart.lines.length}>
      <PencilIcon />
    </Button>
  );
  const cell = (label: string, value: string, action?: ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        {action}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t bg-muted/30 px-4 py-3 text-sm">
      {cell(t("items"), f.qty(totals.itemsCount))}
      {cell(t("subtotal"), f.money(totals.linesTotal))}
      {!settings.pos.disableDiscount && cell(t("discount"), `(-) ${f.money(totals.discount)}`, edit(t("discount"), "discount"))}
      {!settings.pos.disableOrderTax && cell(t("orderTax"), `(+) ${f.money(totals.orderTax)}`, edit(t("orderTax"), "orderTax"))}
      {cell(t("shipping"), `(+) ${f.money(totals.shipping)}`, edit(t("shipping"), "shipping"))}
      {settings.rewards.enabled && cart.contactId !== WALK_IN_ID &&
        cell(t("redeemed"), `(-) ${f.money(totals.redeemed)}`, edit(settings.rewards.displayName || t("redeemed"), "points"))}
      {totals.roundOff !== 0 && cell(t("roundOff"), f.money(totals.roundOff))}
    </dl>
  );
}
