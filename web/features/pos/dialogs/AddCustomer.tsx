"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ValidationError } from "@/lib/data/errors";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { setContact } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

function AddCustomerForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { createCustomer } = usePosMutations();
  const { update } = useCart(locationId);
  const hide = usePosDialogs((s) => s.hide);
  const onError = usePosError();
  const [form, setForm] = useState({ name: "", mobile: "", customerGroupId: "none", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const c = await createCustomer.mutateAsync({
        name: form.name, mobile: form.mobile, address: form.address,
        customerGroupId: form.customerGroupId === "none" ? null : form.customerGroupId,
      });
      update((cart) => setContact(cart, c.id));
      toast.success(t("pos.customer.added"));
      hide();
      focusSearch();
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      else onError(err);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.customer.add")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="nc-name">{t("pos.customer.name")}</Label>
        <Input id="nc-name" autoFocus value={form.name} onChange={(e) => set("name")(e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-destructive">{t("errors.required")}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="nc-mobile">{t("pos.customer.mobile")}</Label>
        <Input id="nc-mobile" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} aria-invalid={!!errors.mobile} />
        {errors.mobile && <p className="text-xs text-destructive">{errors.mobile === "duplicate" ? t("pos.customer.mobileDuplicate") : t("errors.required")}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="nc-group">{t("pos.customer.group")}</Label>
        <Select value={form.customerGroupId} onValueChange={set("customerGroupId")}>
          <SelectTrigger id="nc-group" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.none")}</SelectItem>
            {lookups?.customerGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="nc-address">{t("pos.customer.address")}</Label>
        <Textarea id="nc-address" rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={createCustomer.isPending}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddCustomerDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "addCustomer");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-md">{open && <AddCustomerForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
