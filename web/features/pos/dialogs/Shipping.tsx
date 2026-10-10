"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { useSettings } from "@/lib/data/hooks/settings";
import { patchCart, type CartShipping, type ShippingZone } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

const ZONES: ShippingZone[] = ["inside_dhaka", "outside_dhaka", "free"];

function ShippingForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const { data: settings } = useSettings();
  const { cart, update } = useCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [s, setS] = useState<CartShipping>(cart.shipping);
  const [charges, setCharges] = useState(cart.shipping.charges ? String(cart.shipping.charges) : "");

  const pickZone = (zone: ShippingZone) => {
    setS((x) => ({ ...x, zone }));
    const preset = zone === "free" ? 0 : settings?.pos.shippingCharges[zone] ?? 0;
    setCharges(String(preset));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update((c) => patchCart(c, { shipping: { ...s, charges: Math.max(0, Number(charges) || 0) } }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.shipping.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label>{t("pos.shipping.zone")}</Label>
        <SegmentedControl
          label={t("pos.shipping.zone")}
          className="w-full"
          value={s.zone ?? ""}
          onValueChange={(v) => pickZone(v as ShippingZone)}
          options={ZONES.map((z) => ({ value: z, label: t(`pos.shipping.${z}`) }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-charges">{t("pos.shipping.charges")}</Label>
        <Input id="ship-charges" type="number" min={0} step="any" value={charges} onChange={(e) => setCharges(e.target.value)} className="tabular-nums" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-details">{t("pos.shipping.details")}</Label>
        <Input id="ship-details" value={s.details} onChange={(e) => setS((x) => ({ ...x, details: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-address">{t("pos.shipping.address")}</Label>
        <Textarea id="ship-address" rows={2} value={s.address} onChange={(e) => setS((x) => ({ ...x, address: e.target.value }))} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit">{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function ShippingDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "shipping");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-md">{open && <ShippingForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
