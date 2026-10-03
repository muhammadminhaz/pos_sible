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
import type { Location, PaymentMethod } from "@/lib/data/schemas";
import { ValidationError } from "@/lib/data/errors";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

function ExpenseForm({ location }: { location: Location }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { createExpense } = usePosMutations();
  const hide = usePosDialogs((s) => s.hide);
  const onError = usePosError();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const labels = settings?.customLabels.payments ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tx = await createExpense.mutateAsync({ locationId: location.id, categoryId, amount: Number(amount) || 0, method, note });
      toast.success(t("pos.expense.added", { ref: tx.refNo }));
      hide();
      focusSearch();
    } catch (err) {
      if (err instanceof ValidationError) setInvalid(err.fields);
      else onError(err);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.expense.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label>{t("pos.expense.category")}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full" aria-invalid={!!invalid.categoryId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(lookups?.expenseCategories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="exp-amount">{t("pos.expense.amount")}</Label>
          <Input id="exp-amount" type="number" min={0} step="any" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!invalid.amount} className="tabular-nums" />
        </div>
        <div className="grid gap-2">
          <Label>{t("pos.expense.method")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tillMethods(location.paymentMethods, labels).map((m) => (
                <SelectItem key={m} value={m}>{methodLabel(m, t, labels)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="exp-note">{t("pos.expense.note")}</Label>
        <Textarea id="exp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createExpense.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

export function AddExpenseDialog({ location }: { location: Location }) {
  const open = usePosDialogs((s) => s.open === "expense");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-md">{open && <ExpenseForm location={location} />}</DialogContent>
    </Dialog>
  );
}
