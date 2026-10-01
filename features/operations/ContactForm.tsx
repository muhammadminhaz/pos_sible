"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NumInput, PickField } from "@/features/catalog/formParts";
import { useContact, useContactMutations } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import type { Contact } from "@/lib/data/schemas";
import type { ContactInput } from "@/lib/data/services/contacts";
import { opsErrorMessage } from "./opsError";

const blank = (type: Contact["type"]): ContactInput => ({
  type, kind: "individual", businessName: "", prefix: "", name: "", mobile: "", altNumber: "", landline: "", email: "", dob: null, taxNumber: "",
  customerGroupId: null, payTerm: null, creditLimit: null, openingBalance: 0, assignedTo: [], crmSource: null, crmLifeStage: null,
  address: { line1: "", line2: "", city: "", state: "", country: "Bangladesh", zip: "" }, shippingAddress: "", customFields: Array.from({ length: 10 }, () => ""), active: true,
});

function Form({ initial, id, onClose, onSaved }: { initial: ContactInput; id?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { save } = useContactMutations();
  const [v, setV] = useState<ContactInput>({ ...initial, customFields: Array.from({ length: 10 }, (_, i) => initial.customFields[i] ?? "") });
  const set = (p: Partial<ContactInput>) => setV((s) => ({ ...s, ...p }));
  const setAddr = (p: Partial<ContactInput["address"]>) => set({ address: { ...v.address, ...p } });
  const isCustomer = v.type !== "supplier";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await save.mutateAsync({ ...v, id });
      toast.success(t("ops.contactSaved"));
      onSaved?.(r.id);
      onClose();
    } catch (err) {
      toast.error(opsErrorMessage(err, t));
    }
  };
  const text = (label: string, key: keyof ContactInput, extra: { required?: boolean; type?: string } = {}) => (
    <Field label={label} htmlFor={`c-${String(key)}`}>
      <Input id={`c-${String(key)}`} type={extra.type} required={extra.required} value={(v[key] as string | null) ?? ""} onChange={(e) => set({ [key]: e.target.value } as Partial<ContactInput>)} />
    </Field>
  );
  const users = (lookups?.users ?? []).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }));

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{id ? t("ops.editContact") : t("ops.addContact")}</DialogTitle></DialogHeader>
      <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        <PickField label={t("ops.contactType")} nullable={false} value={v.type} onChange={(x) => set({ type: x as Contact["type"] })}
          options={(["customer", "supplier", "both"] as const).map((x) => ({ value: x, label: t(`ops.type.${x}`) }))} />
        <PickField label={t("ops.kind")} nullable={false} value={v.kind} onChange={(x) => set({ kind: x as Contact["kind"] })}
          options={(["individual", "business"] as const).map((x) => ({ value: x, label: t(`ops.${x}`) }))} />
        {v.kind === "business" && text(t("ops.businessName"), "businessName")}
        {text(t("catalog.name"), "name", { required: true })}
        {text(t("ops.mobile"), "mobile", { required: true })}
        {text(t("ops.altNumber"), "altNumber")}
        {text(t("ops.email"), "email", { type: "email" })}
        {text(t("ops.dob"), "dob", { type: "date" })}
        {text(t("ops.taxNumber"), "taxNumber")}
        {isCustomer && (
          <PickField label={t("ops.customerGroup")} value={v.customerGroupId} onChange={(x) => set({ customerGroupId: x })} options={(lookups?.customerGroups ?? []).map((g) => ({ value: g.id, label: g.name }))} />
        )}
        <Field label={t("ops.openingBalance")}><NumInput label={t("ops.openingBalance")} min={-1e12} value={v.openingBalance} onChange={(n) => set({ openingBalance: n })} /></Field>
        {isCustomer && <Field label={t("ops.creditLimit")} hint={t("ops.creditLimitHint")}><NumInput label={t("ops.creditLimit")} nullable value={v.creditLimit} onChange={(n) => set({ creditLimit: n })} /></Field>}
        <Field label={t("ops.payTerm")}>
          <div className="flex gap-2">
            <NumInput label={t("ops.payTerm")} nullable value={v.payTerm?.number ?? null} onChange={(n) => set({ payTerm: n == null ? null : { number: n, type: v.payTerm?.type ?? "days" } })} />
            <PickField label={t("ops.payTermType")} nullable={false} value={v.payTerm?.type ?? "days"} onChange={(x) => v.payTerm && set({ payTerm: { ...v.payTerm, type: x as "days" | "months" } })}
              options={[{ value: "days", label: t("catalog.days") }, { value: "months", label: t("catalog.months") }]} className="[&>label]:sr-only min-w-28" />
          </div>
        </Field>
        <PickField label={t("ops.crmSource")} value={v.crmSource} onChange={(x) => set({ crmSource: x })} options={["Facebook", "Referral", "Walk-in", "Website", "Phone"].map((x) => ({ value: x, label: x }))} />
        <PickField label={t("ops.crmLifeStage")} value={v.crmLifeStage} onChange={(x) => set({ crmLifeStage: x })} options={["Lead", "Prospect", "Customer", "Loyal"].map((x) => ({ value: x, label: x }))} />
        <Field label={t("ops.assignedTo")} className="sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={v.assignedTo.includes(u.id)} onCheckedChange={(c) => set({ assignedTo: c ? [...v.assignedTo, u.id] : v.assignedTo.filter((x) => x !== u.id) })} />
                {u.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label={t("ops.address")} className="sm:col-span-2"><Input aria-label={t("ops.address")} value={v.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} /></Field>
        <Field label={t("ops.city")}><Input aria-label={t("ops.city")} value={v.address.city} onChange={(e) => setAddr({ city: e.target.value })} /></Field>
        <Field label={t("ops.shippingAddress")} className="sm:col-span-2 lg:col-span-3"><Textarea value={v.shippingAddress} onChange={(e) => set({ shippingAddress: e.target.value })} /></Field>
        {v.customFields.map((cf, i) => (
          <Field key={i} label={t("catalog.customField", { n: i + 1 })} htmlFor={`c-cf-${i}`}>
            <Input id={`c-cf-${i}`} value={cf} onChange={(e) => set({ customFields: v.customFields.map((x, j) => (j === i ? e.target.value : x)) })} />
          </Field>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

/** Add (when `editId` is "new") or edit a contact. */
export function ContactFormDialog({ editId, defaultType, onClose, onSaved }: { editId: string | null; defaultType: Contact["type"]; onClose: () => void; onSaved?: (id: string) => void }) {
  const existing = useContact(editId && editId !== "new" ? editId : undefined).data;
  const ready = editId === "new" || !!existing;
  return (
    <Dialog open={editId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        {editId && ready && (
          <Form
            key={editId}
            id={editId === "new" ? undefined : editId}
            initial={editId === "new" ? blank(defaultType) : (({ id: _id, createdAt: _c, createdBy: _b, code: _code, points: _p, advanceBalance: _a, isDefault: _d, ...rest }) => (void [_id, _c, _b, _code, _p, _a, _d], rest))(existing!)}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
