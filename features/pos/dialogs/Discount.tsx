"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCan } from "@/lib/auth/useCan";
import { discountValue, type DiscountInput } from "@/lib/domain/totals";
import { useFormat } from "@/lib/i18n/format";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosTotals } from "../usePos";

function DiscountForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { cart, update } = useCart(locationId);
  const totals = usePosTotals(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [type, setType] = useState<DiscountInput["type"]>(cart.discount?.type ?? "fixed");
  const [amount, setAmount] = useState(cart.discount?.amount ? String(cart.discount.amount) : "");
  const d: DiscountInput = { type, amount: Math.max(0, Number(amount) || 0) };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update((c) => patchCart(c, { discount: d.amount > 0 ? d : null }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.discount.title")}</DialogTitle>
      </DialogHeader>
      <ToggleGroup type="single" variant="outline" disabled={!can("pos.edit_discount")} value={type} onValueChange={(v) => v && setType(v as DiscountInput["type"])} className="w-full">
        <ToggleGroupItem value="fixed" className="flex-1">{t("pos.discount.fixed")}</ToggleGroupItem>
        <ToggleGroupItem value="percentage" className="flex-1">{t("pos.discount.percentage")}</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid gap-2">
        <Label htmlFor="disc-amount">{t("pos.discount.amount")}</Label>
        <Input id="disc-amount" type="number" min={0} max={type === "percentage" ? 100 : undefined} step="any" autoFocus disabled={!can("pos.edit_discount")} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
      </div>
      <p className="text-sm text-muted-foreground">{t("pos.discount.preview", { amount: f.money(discountValue(totals?.linesTotal ?? 0, d)) })}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!can("pos.edit_discount")}>{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function DiscountDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "discount");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-sm">{open && <DiscountForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
