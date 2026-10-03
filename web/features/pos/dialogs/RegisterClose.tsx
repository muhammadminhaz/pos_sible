"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Location } from "@/lib/data/schemas";
import { useCurrentRegister, usePosMutations, useRegisterSummary } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import { roundMoney } from "@/lib/domain/money";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";
import { Denominations, denominationTotal } from "./Denominations";

function RegisterBody({ location, closing }: { location: Location; closing: boolean }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const register = useCurrentRegister(location.id).data;
  const { data: sum } = useRegisterSummary(register?.id);
  const { closeRegister } = usePosMutations();
  const hide = usePosDialogs((s) => s.hide);
  const onError = usePosError();
  const [counted, setCounted] = useState("");
  const [cardSlips, setCardSlips] = useState<string | null>(null);
  const [cheques, setCheques] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  if (!register || !sum || !settings) return <Skeleton className="h-64" />;

  // Slip and cheque counts start at what the register recorded; the cashier corrects them against the physical slips.
  const slipsValue = cardSlips ?? String(sum.cardSlips);
  const chequesValue = cheques ?? String(sum.cheques);
  const countedCash = Number(counted) || 0;
  const diff = roundMoney(countedCash - sum.expectedCash);
  const row = (label: string, value: number, strong = false) => (
    <tr className={cn("border-b last:border-0", strong && "font-semibold")}>
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{f.money(value)}</td>
    </tr>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await closeRegister.mutateAsync({
        id: register.id, closingAmount: countedCash, totalCardSlips: Number(slipsValue) || 0,
        totalCheques: Number(chequesValue) || 0, closingNote: note, denominations: counts,
      });
      toast.success(t("pos.register.closed"));
      hide();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{closing ? t("pos.register.closeTitle") : t("pos.register.detailsTitle")}</DialogTitle>
        <DialogDescription>{`${location.name} · ${t("pos.register.openedAt", { time: f.dateTime(register.openedAt) })}`}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-6">
        <table className="text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-medium">{t("pos.register.method")}</th>
              <th className="py-1.5 text-right font-medium">{t("pos.register.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {sum.byMethod.map((m) => (
              <tr key={m.method} className="border-b">
                <td className="py-1.5">{`${methodLabel(m.method, t, settings.customLabels.payments)} (${f.number(m.count)})`}</td>
                <td className="py-1.5 text-right tabular-nums">{f.money(m.amount)}</td>
              </tr>
            ))}
            {row(t("pos.register.sales"), sum.totalSales, true)}
          </tbody>
        </table>
        <table className="text-sm">
          <tbody>
            {row(t("pos.register.opening"), sum.opening)}
            {row(`(+) ${t("payMethods.cash")}`, sum.cashIn)}
            {row(`(−) ${t("pos.register.change")}`, sum.change)}
            {row(`(−) ${t("pos.register.refunds")}`, sum.refunds)}
            {row(`(−) ${t("pos.register.expenses")}`, sum.expenses)}
            {row(t("pos.register.expected"), sum.expectedCash, true)}
          </tbody>
        </table>
      </div>

      {closing && (
        <div className="grid gap-4 border-t pt-4">
          {settings.payment.cashDenominations.length > 0 && (
            <Denominations
              notes={settings.payment.cashDenominations}
              counts={counts}
              onChange={(c) => {
                setCounts(c);
                setCounted(String(denominationTotal(c)));
              }}
            />
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="rc-counted">{t("pos.register.counted")}</Label>
              <Input id="rc-counted" type="number" min={0} step="any" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} className="tabular-nums" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="rc-cards">{t("pos.register.cardSlips")}</Label>
              <Input id="rc-cards" type="number" min={0} step={1} value={slipsValue} onChange={(e) => setCardSlips(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("pos.register.expectedCount", { count: f.number(sum.cardSlips) })}</p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="rc-cheques">{t("pos.register.cheques")}</Label>
              <Input id="rc-cheques" type="number" min={0} step={1} value={chequesValue} onChange={(e) => setCheques(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("pos.register.expectedCount", { count: f.number(sum.cheques) })}</p>
            </div>
          </div>
          <p className={cn("text-right text-sm font-medium tabular-nums", diff < 0 ? "text-danger" : diff > 0 ? "text-warning-foreground dark:text-warning" : "text-success")}>
            {`${t("pos.register.difference")}: ${f.money(diff)}`}
          </p>
          <div className="grid gap-1">
            <Label htmlFor="rc-note">{t("pos.register.note")}</Label>
            <Textarea id="rc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.close")}</Button>
        {closing && (
          <Button type="submit" variant="destructive" disabled={closeRegister.isPending}>
            {t("pos.register.closeTitle")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

export function RegisterDialog({ location }: { location: Location }) {
  const open = usePosDialogs((s) => s.open);
  const hide = usePosDialogs((s) => s.hide);
  const shown = open === "registerDetails" || open === "registerClose";
  return (
    <Dialog open={shown} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {shown && <RegisterBody location={location} closing={open === "registerClose"} />}
      </DialogContent>
    </Dialog>
  );
}
