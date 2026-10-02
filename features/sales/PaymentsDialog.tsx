"use client";

import { useState, type FormEvent } from "react";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/Money";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePurchase, usePurchaseMutations } from "@/lib/data/hooks/operations";
import { useSale, useSaleMutations } from "@/lib/data/hooks/sales";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PaymentMethod } from "@/lib/data/schemas";
import { paymentSummary } from "@/lib/domain/payments";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { opsErrorMessage } from "@/features/operations/opsError";
import { saleErrorMessage } from "./saleError";

export type PaymentsKind = "sell" | "purchase";

function Body({ saleId, mode, kind, onClose }: { saleId: string; mode: "add" | "view"; kind: PaymentsKind; onClose: () => void }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const isSale = kind === "sell";
  const saleQ = useSale(isSale ? saleId : undefined);
  const purchaseQ = usePurchase(isSale ? undefined : saleId);
  const sale = isSale ? saleQ.data : purchaseQ.data;
  const errorMessage = isSale ? saleErrorMessage : opsErrorMessage;
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const sm = useSaleMutations();
  const pm = usePurchaseMutations();
  const addPayment = isSale ? sm.addPayment : pm.addPayment;
  const removePayment = isSale ? sm.removePayment : pm.removePayment;
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  if (!sale) return null;

  const labels = settings?.customLabels.payments ?? [];
  const location = lookups?.locations.find((l) => l.id === sale.locationId);
  const methods = tillMethods(location?.paymentMethods ?? ["cash"], labels);
  const { due } = paymentSummary(sale.totals.total, sale.payments);
  const payments = sale.payments.filter((p) => !p.isReturn);
  const canAdd = can(isSale ? "sell.payments" : "purchase.payments") && due > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addPayment.mutateAsync({ id: sale.id, payment: { method, amount: Number(amount || due), note } });
      toast.success(t("sales.paymentAdded"));
      setAmount("");
      setNote("");
      if (mode === "add") onClose();
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };
  const remove = async (paymentId: string) => {
    try {
      await removePayment.mutateAsync({ id: sale.id, paymentId });
      toast.success(t("sales.paymentRemoved"));
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("sales.paymentsTitle", { refNo: sale.refNo })}</DialogTitle>
      </DialogHeader>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <span>{t("common.total")}: <Money value={sale.totals.total} className="font-medium" /></span>
        <span>{t("status.due")}: <Money value={due} className="font-semibold" /></span>
      </div>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("sales.noPayments")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("sales.refNo")}</TableHead>
              <TableHead>{t("sales.paymentMethod")}</TableHead>
              <TableHead className="text-right">{t("sales.expenseAmount")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap tabular">{f.dateTime(p.paidOn)}</TableCell>
                <TableCell className="tabular">{p.refNo}</TableCell>
                <TableCell>{methodLabel(p.method, t, labels)}</TableCell>
                <TableCell className="text-right"><Money value={p.amount} /></TableCell>
                <TableCell>
                  {can(isSale ? "sell.payments" : "purchase.payments") && (
                    <Button variant="ghost" size="icon-sm" aria-label={t("sales.removePayment")} onClick={() => remove(p.id)} disabled={removePayment.isPending}>
                      <Trash2Icon />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {canAdd && (
        <form onSubmit={submit} className="grid gap-3 border-t pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pay-amount">{t("sales.expenseAmount")}</Label>
              <Input id="pay-amount" type="number" min={0} step="any" autoFocus={mode === "add"} value={amount} placeholder={String(due)} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
            </div>
            <div className="grid gap-2">
              <Label>{t("sales.paymentMethod")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => <SelectItem key={m} value={m}>{methodLabel(m, t, labels)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-note">{t("common.note")}</Label>
            <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("common.close")}</Button>
            <Button type="submit" disabled={addPayment.isPending}>{t("sales.addPayment")}</Button>
          </DialogFooter>
        </form>
      )}
      {!canAdd && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      )}
    </div>
  );
}

export function PaymentsDialog({ saleId, mode, kind = "sell", onClose }: { saleId: string | null; mode: "add" | "view"; kind?: PaymentsKind; onClose: () => void }) {
  return (
    <Dialog open={saleId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">{saleId && <Body saleId={saleId} mode={mode} kind={kind} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
