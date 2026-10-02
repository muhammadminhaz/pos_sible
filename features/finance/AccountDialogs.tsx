"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/Money";
import { Field, NumInput, PickField } from "@/features/catalog/formParts";
import { useAccountMutations, useAccounts } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import type { AccountInput, AccountRow } from "@/lib/data/services/accounts";
import { nowStamp } from "./ExpenseForm";
import { financeErrorMessage } from "./financeError";

function FormBody({ account, onClose }: { account: AccountRow | null; onClose: () => void }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { save } = useAccountMutations();
  const [v, setV] = useState<AccountInput>(
    account
      ? { id: account.id, name: account.name, typeId: account.typeId, number: account.number, note: account.note, details: account.details, openingBalance: 0, allowOverdraft: account.allowOverdraft }
      : { name: "", typeId: null, number: "", note: "", details: [], openingBalance: 0, allowOverdraft: false },
  );
  const set = (p: Partial<AccountInput>) => setV((s) => ({ ...s, ...p }));
  const types = lookups?.accountTypes ?? [];
  const typeLabel = (id: string) => {
    const ty = types.find((x) => x.id === id);
    const parent = types.find((x) => x.id === ty?.parentId);
    return parent ? `${parent.name} › ${ty?.name}` : (ty?.name ?? "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync(v);
      toast.success(t("finance.accountSaved"));
      onClose();
    } catch (err) {
      toast.error(financeErrorMessage(err, t));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{account ? t("finance.editAccount") : t("finance.addAccount")}</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("finance.accountName")} htmlFor="ac-name"><Input id="ac-name" required autoFocus value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label={t("finance.accountNumber")} htmlFor="ac-num"><Input id="ac-num" value={v.number} onChange={(e) => set({ number: e.target.value })} /></Field>
        <PickField label={t("finance.accountType")} value={v.typeId} onChange={(x) => set({ typeId: x })} options={types.map((x) => ({ value: x.id, label: typeLabel(x.id) }))} />
        {!account && <Field label={t("finance.openingBalance")}><NumInput label={t("finance.openingBalance")} value={v.openingBalance} onChange={(n) => set({ openingBalance: n })} /></Field>}
      </div>
      <Field label={t("common.note")} htmlFor="ac-note"><Textarea id="ac-note" value={v.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>{t("finance.accountDetails")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => set({ details: [...v.details, { label: "", value: "" }] })}><PlusIcon />{t("common.add")}</Button>
        </div>
        {v.details.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label={t("finance.detailLabel")} placeholder={t("finance.detailLabel")} value={d.label} onChange={(e) => set({ details: v.details.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Input aria-label={t("finance.detailValue")} placeholder={t("finance.detailValue")} value={d.value} onChange={(e) => set({ details: v.details.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => set({ details: v.details.filter((_, j) => j !== i) })}><XIcon /></Button>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={v.allowOverdraft} onCheckedChange={(c) => set({ allowOverdraft: c })} />{t("finance.allowOverdraft")}</label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

/** `account` null = new; undefined = closed. */
export function AccountFormDialog({ account, onClose }: { account: AccountRow | null | undefined; onClose: () => void }) {
  return (
    <Dialog open={account !== undefined} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">{account !== undefined && <FormBody account={account} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

export type MoveMode = { kind: "transfer" | "deposit"; accountId: string };

function MoveBody({ mode, onClose }: { mode: MoveMode; onClose: () => void }) {
  const t = useTranslations();
  const { data: accounts } = useAccounts({ status: "active" });
  const { transfer, deposit } = useAccountMutations();
  const isTransfer = mode.kind === "transfer";
  const current = accounts?.find((a) => a.id === mode.accountId);
  const [other, setOther] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => nowStamp(new Date()).slice(0, 16));
  const options = (accounts ?? []).filter((a) => a.id !== mode.accountId).map((a) => ({ value: a.id, label: a.name }));
  const pending = transfer.isPending || deposit.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const when = `${date}:00`;
    try {
      if (isTransfer) await transfer.mutateAsync({ from: mode.accountId, to: other ?? "", amount: amount ?? 0, note, date: when });
      else await deposit.mutateAsync({ accountId: mode.accountId, fromAccountId: other, amount: amount ?? 0, note, date: when });
      toast.success(t(isTransfer ? "finance.transferDone" : "finance.depositDone"));
      onClose();
    } catch (err) {
      toast.error(financeErrorMessage(err, t));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{t(isTransfer ? "finance.transferTitle" : "finance.depositTitle", { name: current?.name ?? "" })}</DialogTitle></DialogHeader>
      {current && <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>{t("finance.balance")}</span><Money value={current.balance} className="font-semibold" /></div>}
      <PickField label={t(isTransfer ? "finance.toAccount" : "finance.depositFrom")} nullable={!isTransfer} value={other} onChange={setOther} options={options} />
      {!isTransfer && <p className="-mt-2 text-xs text-muted-foreground">{t("finance.depositFromHint")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("finance.amount")}><NumInput label={t("finance.amount")} nullable value={amount} onChange={setAmount} /></Field>
        <Field label={t("common.date")} htmlFor="mv-date"><Input id="mv-date" type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label={t("common.note")} htmlFor="mv-note"><Textarea id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={pending || !amount || (isTransfer && !other)}>{t(isTransfer ? "finance.transfer" : "finance.deposit")}</Button>
      </DialogFooter>
    </form>
  );
}

export function MoveMoneyDialog({ mode, onClose }: { mode: MoveMode | null; onClose: () => void }) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">{mode && <MoveBody mode={mode} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
