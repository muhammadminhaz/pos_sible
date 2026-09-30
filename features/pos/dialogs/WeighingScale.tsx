"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePosLookup } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { parseScaleBarcode } from "@/lib/pos/scale";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { useAddToCart } from "../usePos";

function ScaleForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { cart } = useCart(locationId);
  const lookup = usePosLookup();
  const add = useAddToCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [code, setCode] = useState("");
  const parsed = settings && code.trim() ? parseScaleBarcode(code, settings.pos.weighingScale) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    const hit = (await lookup({ locationId, contactId: cart.contactId, term: parsed.sku })).find((h) => h.exact);
    if (!hit) return void toast.error(t("pos.search.noMatch", { term: parsed.sku }));
    if (add(hit.product, hit.variation, parsed.qty)) {
      hide();
      focusSearch();
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.scale.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="scale-code">{t("pos.scale.barcode")}</Label>
        <Input id="scale-code" autoFocus autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {code.trim() && (parsed ? t("pos.scale.parsed", { sku: parsed.sku, qty: f.qty(parsed.qty) }) : t("pos.scale.invalid"))}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={!parsed}>{t("common.add")}</Button>
      </DialogFooter>
    </form>
  );
}

export function WeighingScaleDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "scale");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-sm">{open && <ScaleForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
