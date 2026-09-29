"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Location, Payment, PaymentMethod } from "@/lib/data/schemas";
import { useSettings } from "@/lib/data/hooks/settings";
import type { CheckoutPayment } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { WALK_IN_ID } from "@/lib/pos/cart";
import { useHotkeys } from "@/lib/pos/hotkeys";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { paymentState } from "@/lib/pos/selectors";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { useCheckout } from "../usePosAction";
import { usePosTotals } from "../usePos";
import { Denominations, denominationTotal } from "./Denominations";

type Row = { id: number; method: PaymentMethod; amount: string; details: Payment["details"]; counts: Record<string, number> };

let seq = 0;
const newRow = (method: PaymentMethod, amount: number): Row => ({ id: ++seq, method, amount: amount ? String(amount) : "", details: {}, counts: {} });

function PaymentForm({ location }: { location: Location }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { cart } = useCart(location.id);
  const totals = usePosTotals(location.id);
  const mode = usePosDialogs((s) => s.paymentMode);
  const hide = usePosDialogs((s) => s.hide);
  const { run, pending } = useCheckout(location.id);
  const payable = totals?.total ?? 0;
  const [rows, setRows] = useState<Row[]>(() => [newRow(mode === "multiple" ? "cash" : mode, payable)]);
  const [note, setNote] = useState("");
  const shortcuts = settings?.pos.shortcuts;
  const state = paymentState(payable, rows.map((r) => ({ method: r.method, amount: Number(r.amount) || 0 })));

  const addRow = () => setRows((rs) => [...rs, newRow("cash", state.shortfall)]);
  useHotkeys({
    [shortcuts?.addPaymentRow ?? ""]: addRow,
    [shortcuts?.finalizePayment ?? ""]: () => void finalize(),
  });
  if (!settings) return null;

  const labels = settings.customLabels.payments;
  const methods = tillMethods(location.paymentMethods, labels);
  const pay = settings.payment;
  const denomFor = (m: PaymentMethod) => pay.cashDenominations.length > 0 && pay.denominationMethods.includes(m);
  const strictMismatch = pay.denominationStrict && rows.some((r) => denomFor(r.method) && denominationTotal(r.counts) !== (Number(r.amount) || 0));
  const walkIn = cart.contactId === WALK_IN_ID;
  const blocked = state.nonCashOverpaid || strictMismatch || (state.shortfall > 0 && walkIn) || pending;

  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  async function finalize() {
    if (!settings || blocked) return; // `settings` first: `blocked` isn't initialised on the loading render
    const payments: CheckoutPayment[] = rows
      .map((r) => ({ method: r.method, amount: Number(r.amount) || 0, details: r.details }))
      .filter((p) => p.amount > 0);
    await run("final", payments, note || undefined);
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void finalize();
  };

  const detail = (r: Row, key: keyof Payment["details"], label: string, cls = "") => (
    <div className={cn("grid gap-1", cls)}>
      <Label className="text-xs">{label}</Label>
      <Input value={r.details[key] ?? ""} onChange={(e) => patch(r.id, { details: { ...r.details, [key]: e.target.value } })} className="h-8" />
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.pay.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_16rem] gap-5">
        <div className="grid max-h-[60vh] content-start gap-3 overflow-auto pr-1">
          {rows.map((r, i) => (
            <div key={r.id} className="grid gap-3 rounded-lg border bg-card p-3">
              <div className="flex items-end gap-2">
                <div className="grid flex-1 gap-1">
                  <Label className="text-xs">{t("pos.pay.method")}</Label>
                  <Select value={r.method} onValueChange={(m) => patch(r.id, { method: m as PaymentMethod, details: {}, counts: {} })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m} value={m}>
                          {methodLabel(m, t, labels)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid flex-1 gap-1">
                  <Label className="text-xs" htmlFor={`amt-${r.id}`}>
                    {r.method === "cash" ? t("pos.pay.given") : t("pos.pay.amount")}
                  </Label>
                  <Input
                    id={`amt-${r.id}`}
                    type="number"
                    min={0}
                    step="any"
                    autoFocus={i === rows.length - 1}
                    readOnly={pay.denominationStrict && denomFor(r.method)}
                    value={r.amount}
                    onChange={(e) => patch(r.id, { amount: e.target.value })}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-9 text-right text-base tabular-nums"
                  />
                </div>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("pos.pay.removeRow")} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                    <Trash2Icon />
                  </Button>
                )}
              </div>
              {r.method === "card" && (
                <div className="grid grid-cols-2 gap-2">
                  {detail(r, "cardNumber", t("pos.pay.cardNumber"))}
                  {detail(r, "cardHolder", t("pos.pay.cardHolder"))}
                  <div className="grid gap-1">
                    <Label className="text-xs">{t("pos.pay.cardType")}</Label>
                    <Select value={r.details.cardType ?? ""} onValueChange={(v) => patch(r.id, { details: { ...r.details, cardType: v as NonNullable<Payment["details"]["cardType"]> } })}>
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["visa", "master", "credit", "debit"] as const).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {detail(r, "cardTxnNo", t("pos.pay.txnNo"))}
                </div>
              )}
              {r.method.startsWith("custom_pay_") && detail(r, "txnNo", t("pos.pay.txnNo"))}
              {r.method === "cheque" && detail(r, "chequeNo", t("payMethods.cheque"))}
              {r.method === "bank_transfer" && detail(r, "bankAccountNo", t("payMethods.bank_transfer"))}
              {denomFor(r.method) && (
                <Denominations
                  notes={pay.cashDenominations}
                  counts={r.counts}
                  onChange={(counts) => patch(r.id, { counts, amount: String(denominationTotal(counts)) })}
                />
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addRow} className="justify-self-start">
            <PlusIcon />
            {t("pos.pay.addRow")}
          </Button>
          <div className="grid gap-1">
            <Label className="text-xs" htmlFor="pay-note">{t("common.note")}</Label>
            <Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <dl className="grid content-start gap-3 rounded-xl bg-muted/50 p-4 text-sm" aria-live="polite">
          <div>
            <dt className="text-muted-foreground">{t("pos.totals.payable")}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{f.money(payable)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("pos.pay.paid")}</dt>
            <dd className="tabular-nums">{f.money(state.paid)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("pos.pay.remaining")}</dt>
            <dd className={cn("tabular-nums", state.shortfall > 0 && "font-medium text-danger")}>{f.money(state.shortfall)}</dd>
          </div>
          <div className="flex justify-between border-t pt-3">
            <dt className="font-medium">{t("pos.pay.change")}</dt>
            <dd className="text-xl font-semibold text-success tabular-nums">{f.money(state.change)}</dd>
          </div>
          {state.nonCashOverpaid && <p className="text-xs text-danger">{t("pos.pay.nonCashOverpaid")}</p>}
          {state.shortfall > 0 && walkIn && <p className="text-xs text-danger">{t("pos.errors.walkInCredit")}</p>}
        </dl>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={blocked}>
          {t("pos.pay.finalize")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PaymentDialog({ location }: { location: Location }) {
  const open = usePosDialogs((s) => s.open === "payment");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-3xl">{open && <PaymentForm location={location} />}</DialogContent>
    </Dialog>
  );
}
