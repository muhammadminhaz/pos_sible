"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money } from "@/components/shared/Money";
import { useContact, useContactMutations } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PaymentMethod } from "@/lib/data/schemas";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { opsErrorMessage } from "./opsError";

function Body({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations();
  const { data: c } = useContact(id);
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { payDue } = useContactMutations();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  if (!c) return null;
  const owed = Math.max(0, c.sellDue + c.purchaseDue + Math.max(0, c.openingBalance));
  const labels = settings?.customLabels.payments ?? [];
  const methods = tillMethods(lookups?.locations[0]?.paymentMethods ?? ["cash"], labels);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await payDue.mutateAsync({ id, amount: Number(amount || owed), method, note });
      toast.success(t("ops.duePaid"));
      onClose();
    } catch (err) {
      toast.error(opsErrorMessage(err, t));
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{t("ops.payDueTitle", { name: c.name })}</DialogTitle></DialogHeader>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <span>{t("ops.totalDue")}</span><Money value={owed} className="font-semibold" />
      </div>
      <p className="text-sm text-muted-foreground">{t("ops.payDueHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="due-amount">{t("sales.expenseAmount")}</Label>
          <Input id="due-amount" type="number" min={0} step="any" autoFocus placeholder={String(owed)} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
        </div>
        <div className="grid gap-2">
          <Label>{t("sales.paymentMethod")}</Label>
          <Select value={method} onValueChange={(x) => setMethod(x as PaymentMethod)}>
            <SelectTrigger aria-label={t("sales.paymentMethod")} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{methods.map((m) => <SelectItem key={m} value={m}>{methodLabel(m, t, labels)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2"><Label htmlFor="due-note">{t("common.note")}</Label><Input id="due-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={payDue.isPending || owed <= 0}>{t("ops.payDue")}</Button>
      </DialogFooter>
    </form>
  );
}

export function PayDueDialog({ contactId, onClose }: { contactId: string | null; onClose: () => void }) {
  return (
    <Dialog open={contactId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{contactId && <Body id={contactId} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
