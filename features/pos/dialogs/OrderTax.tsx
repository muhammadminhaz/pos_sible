"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useFormat } from "@/lib/i18n/format";
import { patchCart } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

const NONE = "none";

function OrderTaxForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: lookups } = useLookups();
  const { cart, update } = useCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const [taxId, setTaxId] = useState(cart.orderTaxId ?? NONE);
  const rates = lookups?.taxRates ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const rate = rates.find((r) => r.id === taxId);
    update((c) => patchCart(c, { orderTaxId: rate?.id ?? null, orderTaxRate: rate?.rate ?? 0 }));
    hide();
    focusSearch();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.orderTax.title")}</DialogTitle>
      </DialogHeader>
      <Select value={taxId} onValueChange={setTaxId}>
        <SelectTrigger className="w-full" autoFocus>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("pos.orderTax.none")}</SelectItem>
          {rates.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {`${r.name} (${f.percent(r.rate)})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit">{t("common.apply")}</Button>
      </DialogFooter>
    </form>
  );
}

export function OrderTaxDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "orderTax");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-sm">{open && <OrderTaxForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
