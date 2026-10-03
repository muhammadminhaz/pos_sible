"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImageIcon, Loader2Icon, ReceiptIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { addTerms, call, callForm, day, formatMoney, priceText, termText, type Business, type Payment, type Plan } from "./api";
import { Empty } from "./parts";

export const planText = (p: Plan) => `${p.label} · ${priceText(p)} · ${p.maxUsers === null ? "unlimited users" : `up to ${p.maxUsers} users`}`;

const MAX_PROOF = 2 * 1024 * 1024;
type When = "now" | "renew" | "end";

/**
 * Activates a subscription after money came in, or moves a business to another package. Activating writes the payment
 * down as received today, with a transaction id and/or a proof image. A different package can start now (the current
 * term ends and a new one begins), apply when the current term ends (nothing is paid yet), or, if it was already
 * scheduled, come in with this renewal.
 */
export function ActivateForm({ business, plans, onClose, onDone }: { business: Business; plans: Plan[]; onClose: () => void; onDone: () => void }) {
  const [planId, setPlanId] = useState(business.nextPlan ?? business.plan);
  const [when, setWhen] = useState<When>(business.nextPlan ? "renew" : "now");
  const [terms, setTerms] = useState("1");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const changed = planId !== business.plan;
  const mode: When = changed ? when : "renew";
  const n = Math.max(1, Math.floor(Number(terms)) || 1);
  const list = business.free ? 0 : plan.price * n;
  const amount = received.trim() === "" ? list : Number(received);
  const badAmount = !Number.isFinite(amount) || amount < 0;
  const needsProof = mode !== "end" && !business.free && amount > 0 && !reference.trim() && !proof;
  const badProof = proof !== null && (proof.size > MAX_PROOF || !/^image\/(png|jpeg|webp)$/.test(proof.type));

  // Mirrors the server: an active term is extended from its end date unless a fresh one starts now.
  const live = business.state === "active" && business.expiresAt !== null && new Date(business.expiresAt) > new Date() && !business.free;
  const from = mode === "now" || !live ? new Date() : new Date(business.expiresAt!);
  const until = addTerms(from, plan, n);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (badAmount || needsProof || badProof) return;
    setBusy(true);
    if (mode === "end") {
      const res = await call(`businesses/${business.id}/schedule`, { method: "POST", body: JSON.stringify({ plan: planId }) }).catch(() => null);
      setBusy(false);
      if (!res?.ok) return void toast.error("Couldn't schedule the change.");
      toast.success(`${business.name} moves to ${plan.label} when the current term ends`);
      return onDone();
    }
    const form = new FormData();
    form.set("terms", String(n));
    form.set("plan", planId);
    form.set("restart", String(mode === "now"));
    if (received.trim() !== "") form.set("amount", String(amount));
    if (reference.trim()) form.set("reference", reference.trim());
    if (proof) form.set("proof", proof);
    const res = await callForm(`businesses/${business.id}/activate`, form).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      return void toast.error(body?.reason === "proof_required" ? "Add a transaction ID or a proof image for the payment." : body?.reason === "proof_type" ? "The proof must be a PNG, JPG or WebP image." : body?.reason === "proof_too_large" ? "The proof image is over 2 MB." : "Couldn't activate the subscription.");
    }
    toast.success(`${business.name} is active until ${day((await res.json()).expiresAt)}`);
    onDone();
  };

  const choices: { value: When; title: string; hint: string }[] = [
    { value: "now", title: "Start now", hint: "The current term ends today and a new one starts today on the new package." },
    ...(business.nextPlan === planId ? [{ value: "renew" as const, title: "Renew, then switch", hint: "Adds a term of the new package after the current one ends." }] : []),
    { value: "end", title: "When the current term ends", hint: "Nothing is paid now. It applies the next time you activate this business." },
  ];

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{business.state === "active" && live ? "Renew or change package" : "Activate subscription"}</DialogTitle>
        <DialogDescription>{business.name}. Only activate after the payment has reached you: today is recorded as the day it was paid.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="a-plan">Package</Label>
        <Select value={planId} onValueChange={(v) => { setPlanId(v); setWhen(v === business.nextPlan ? "renew" : "now"); }}>
          <SelectTrigger id="a-plan" aria-label="Package" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{planText(p)}{p.id === business.plan ? " (current)" : ""}</SelectItem>)}</SelectContent>
        </Select>
        {business.nextPlan && business.nextPlan !== business.plan && <p className="text-xs text-muted-foreground">Already scheduled: {business.nextPlanLabel} when the current term ends.</p>}
      </div>
      {changed && (
        <RadioGroup value={when} onValueChange={(v) => setWhen(v as When)} aria-label="When the new package starts">
          {choices.map((c) => (
            <label key={c.value} htmlFor={`when-${c.value}`} className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2">
              <RadioGroupItem id={`when-${c.value}`} value={c.value} className="mt-1" />
              <span className="grid text-sm leading-tight"><span className="font-medium">{c.title}</span><span className="text-xs text-muted-foreground">{c.hint}</span></span>
            </label>
          ))}
        </RadioGroup>
      )}
      {mode !== "end" ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="a-terms">Terms paid ({termText(plan.periodUnit, plan.periodCount)} each)</Label>
            <Input id="a-terms" type="number" min={1} max={60} step={1} value={terms} onChange={(e) => setTerms(e.target.value)} required />
          </div>
          <p className="text-sm text-muted-foreground">Active until <span className="font-medium text-foreground">{day(until.toISOString())}</span></p>
          {business.free ? <p className="text-sm text-muted-foreground">This is a free account: the activation is recorded today with no amount.</p> : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="a-amount">Amount received</Label>
                <Input id="a-amount" inputMode="decimal" autoComplete="off" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(list)} aria-invalid={badAmount} aria-describedby="a-amount-hint" />
                <p id="a-amount-hint" className={badAmount ? "text-sm text-danger" : "text-xs text-muted-foreground"}>{badAmount ? "Enter an amount of zero or more." : `Counts as revenue. Leave it empty for the price, ${formatMoney(list)}. 0 records the activation with no money.`}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="a-ref">Transaction ID</Label>
                <Input id="a-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} autoComplete="off" placeholder="bKash, Nagad or bank reference" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="a-proof">Proof image (screenshot or photo of the payment)</Label>
                <Input id="a-proof" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProof(e.target.files?.[0] ?? null)} aria-invalid={badProof} />
                {badProof && <p role="alert" className="text-sm text-danger">Use a PNG, JPG or WebP image under 2 MB.</p>}
              </div>
              {needsProof && <p role="alert" className="text-sm text-danger">Add a transaction ID or a proof image so this payment can be checked later.</p>}
            </>
          )}
        </>
      ) : <p className="text-sm text-muted-foreground">{business.name} stays on {business.planLabel} until {business.expiresAt ? day(business.expiresAt) : "its term ends"}.</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || badAmount || needsProof || badProof}>{busy && <Loader2Icon className="animate-spin" />}{mode === "end" ? "Schedule change" : "Activate"}</Button>
      </DialogFooter>
    </form>
  );
}

/** Every payment recorded for a business: the date it was paid, what, the transaction ID and the proof image. */
export function PaymentsDialog({ business, onClose }: { business: Business | null; onClose: () => void }) {
  return (
    <Dialog open={business !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">{business && <PaymentsBody key={business.id} business={business} />}</DialogContent>
    </Dialog>
  );
}

function PaymentsBody({ business }: { business: Business }) {
  const [rows, setRows] = useState<Payment[] | null | undefined>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    call(`businesses/${business.id}/payments`).then(async (res) => { if (live) setRows(res.ok ? (await res.json()).payments : undefined); }).catch(() => live && setRows(undefined));
    return () => { live = false; };
  }, [business.id]);

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Payments from {business.name}</DialogTitle>
        <DialogDescription>Each activation is recorded as paid on the day you activated it.</DialogDescription>
      </DialogHeader>
      {rows === null ? <Skeleton className="h-24 w-full rounded-2xl" /> : rows === undefined ? <Empty icon={ReceiptIcon}>We couldn&apos;t load the payments. Close this and try again.</Empty> : rows.length === 0 ? <Empty icon={ReceiptIcon}>No payments recorded yet. They appear here when you activate this subscription.</Empty> : (
        <ul className="grid gap-2">
          {rows.map((p) => (
            <li key={p.id} className="grid gap-2 rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="grid min-w-0">
                  <span className="font-medium">{day(p.paidAt)} · {p.planLabel}</span>
                  <span className="text-xs text-muted-foreground">{p.terms} × {termText(p.periodUnit, p.periodCount)}{p.reference ? ` · Transaction ${p.reference}` : ""}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(p.amount)}</span>
              </div>
              {p.hasProof && (
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setViewing(viewing === p.id ? null : p.id)}><ImageIcon />{viewing === p.id ? "Hide proof" : "View proof"}</Button>
                  {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated admin-only image, served by the API */}
                  {viewing === p.id && <img src={`/api/admin/payments/${p.id}/proof`} alt={`Payment proof for ${day(p.paidAt)}`} className="mt-2 max-h-96 w-auto max-w-full rounded-lg border" />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CancelDialog({ business, onClose, onDone }: { business: Business | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!business) return;
    setBusy(true);
    const res = await call(`businesses/${business.id}/cancel`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't cancel the subscription.");
    toast.success(`${business.name}'s subscription is cancelled`);
    onDone();
  };
  return (
    <AlertDialog open={business !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {business?.name}&apos;s subscription?</AlertDialogTitle>
          <AlertDialogDescription>Everyone in this business is signed out now and cannot sign in until you activate it again. Their data is kept.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep subscription</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={(e) => { e.preventDefault(); void cancel(); }}>{busy && <Loader2Icon className="animate-spin" />}Cancel subscription</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
