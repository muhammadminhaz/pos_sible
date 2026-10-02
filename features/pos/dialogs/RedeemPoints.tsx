"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContact } from "@/lib/data/hooks/contacts";
import { useSettings } from "@/lib/data/hooks/settings";
import { isValidRedeem, maxRedeemable, redeemValue } from "@/lib/domain/rewards";
import { useFormat } from "@/lib/i18n/format";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosTotals } from "../usePos";

function RedeemForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { cart, update } = useCart(locationId);
  const { data: contact } = useContact(cart.contactId);
  const totals = usePosTotals(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [points, setPoints] = useState(cart.pointsRedeemed ? String(cart.pointsRedeemed) : "");
  if (!settings || !totals) return null;

  const balance = contact?.points ?? 0;
  const max = maxRedeemable({ total: totals.total + totals.redeemed, balance, s: settings.rewards });
  const n = Math.floor(Number(points) || 0);
  const valid = isValidRedeem(n, max, settings.rewards);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    update((c) => patchCart(c, { pointsRedeemed: n }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{settings.rewards.displayName || t("pos.points.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-1 text-sm">
        <p>{t("pos.points.available", { points: f.number(balance) })}</p>
        <p className="text-muted-foreground">{t("pos.points.max", { points: f.number(max) })}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="redeem">{t("pos.points.label")}</Label>
        <Input id="redeem" type="number" min={0} max={max} step={1} autoFocus value={points} onChange={(e) => setPoints(e.target.value)} aria-invalid={!valid} className="tabular-nums" />
        {!valid && <p className="text-xs text-destructive">{t("pos.errors.pointsInvalid")}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{t("pos.points.value", { amount: f.money(redeemValue(valid ? n : 0, settings.rewards)) })}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!valid}>{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function RedeemPointsDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "points");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-sm">{open && <RedeemForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
