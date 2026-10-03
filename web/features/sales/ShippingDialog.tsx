"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSale, useSaleMutations } from "@/lib/data/hooks/sales";
import { SHIPPING_STATUSES, type ShippingStatus } from "@/lib/data/schemas";
import { saleErrorMessage } from "./saleError";

const NONE = "none";

function Form({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const t = useTranslations();
  const { data: sale } = useSale(saleId);
  const { data: lookups } = useLookups();
  const { setShipping } = useSaleMutations();
  const [edit, setEdit] = useState<{ status?: ShippingStatus; deliveredTo?: string; person?: string; details?: string; address?: string }>({});
  if (!sale) return null;
  const s = sale.shipping;
  const v = {
    status: edit.status ?? s.status ?? "ordered",
    deliveredTo: edit.deliveredTo ?? s.deliveredTo,
    person: edit.person ?? s.deliveryPersonId ?? NONE,
    details: edit.details ?? s.details,
    address: edit.address ?? s.address,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setShipping.mutateAsync({
        id: sale.id,
        patch: { status: v.status, deliveredTo: v.deliveredTo, deliveryPersonId: v.person === NONE ? null : v.person, details: v.details, address: v.address },
      });
      toast.success(t("sales.shippingUpdated"));
      onClose();
    } catch (err) {
      toast.error(saleErrorMessage(err, t));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("sales.shippingTitle", { refNo: sale.refNo })}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>{t("sales.shippingStatus")}</Label>
          <Select value={v.status} onValueChange={(x) => setEdit({ ...edit, status: x as ShippingStatus })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHIPPING_STATUSES.map((x) => <SelectItem key={x} value={x}>{t(`status.${x === "ordered" ? "ordered_shipping" : x}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("sales.deliveryPerson")}</Label>
          <Select value={v.person} onValueChange={(x) => setEdit({ ...edit, person: x })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {(lookups?.users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`.trim()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-to">{t("sales.deliveredTo")}</Label>
        <Input id="ship-to" value={v.deliveredTo} onChange={(e) => setEdit({ ...edit, deliveredTo: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-details">{t("sales.shippingDetails")}</Label>
        <Textarea id="ship-details" rows={2} value={v.details} onChange={(e) => setEdit({ ...edit, details: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ship-address">{t("sales.shippingAddress")}</Label>
        <Textarea id="ship-address" rows={2} value={v.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={setShipping.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

export function ShippingDialog({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  return (
    <Dialog open={saleId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">{saleId && <Form saleId={saleId} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
