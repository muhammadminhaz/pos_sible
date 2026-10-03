"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { Field, NumInput, PickField, Section } from "@/features/catalog/formParts";
import { PaymentsDialog } from "@/features/sales/PaymentsDialog";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useExpenseMutations } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PaymentMethod } from "@/lib/data/schemas";
import type { ExpenseInput } from "@/lib/data/services/expenses";
import { roundMoney } from "@/lib/domain/money";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { financeErrorMessage } from "./financeError";

const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
export { stamp as nowStamp };

const RECURRING: NonNullable<ExpenseInput["recurring"]> = { interval: 1, intervalType: "months", repetitions: null, repeatOn: null };

export function ExpenseForm({ id, init }: { id?: string; init: Omit<ExpenseInput, "payments"> }) {
  const t = useTranslations();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { data: contacts } = useContacts({ pageSize: -1 });
  const { save } = useExpenseMutations();
  const [v, setV] = useState(init);
  const [pay, setPay] = useState<{ amount: number | null; method: PaymentMethod }>({ amount: null, method: "cash" });
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const set = (p: Partial<ExpenseInput>) => setV((s) => ({ ...s, ...p }));
  const cats = lookups?.expenseCategories ?? [];
  const taxes = lookups?.taxRates ?? [];
  const rate = taxes.find((x) => x.id === v.taxId)?.rate ?? 0;
  const tax = roundMoney((v.amount * rate) / 100);
  const total = roundMoney(v.amount + tax);

  const location = lookups?.locations.find((l) => l.id === v.locationId);
  const labels = settings?.customLabels.payments ?? [];
  const methods = tillMethods(location?.paymentMethods ?? ["cash"], labels);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payments = !id && pay.amount && pay.amount > 0 ? [{ method: pay.method, amount: pay.amount, paidOn: v.date }] : undefined;
    try {
      const r = await save.mutateAsync({ ...v, id, payments });
      toast.success(t("finance.expenseSaved", { refNo: r.refNo }));
      router.push("/expenses");
    } catch (err) {
      toast.error(financeErrorMessage(err, t));
    }
  };

  const rec = v.recurring;
  return (
    <form onSubmit={submit} className="grid gap-4 pb-24">
      <PageHeader title={id ? t("nav.editExpense") : t("nav.addExpense")} description={t("finance.expenseFormDescription")} />

      <Section title={t("finance.expenseDetails")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PickField label={t("common.location")} nullable={false} value={v.locationId || null} onChange={(x) => set({ locationId: x ?? "" })} options={(lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} />
          <PickField label={t("finance.category")} nullable={false} value={v.categoryId || null} onChange={(x) => set({ categoryId: x ?? "", subCategoryId: null })} options={cats.filter((c) => !c.parentId).map((c) => ({ value: c.id, label: c.name }))} />
          <PickField label={t("finance.subCategory")} value={v.subCategoryId ?? null} onChange={(x) => set({ subCategoryId: x })} options={cats.filter((c) => c.parentId === v.categoryId).map((c) => ({ value: c.id, label: c.name }))} />
          <Field label={t("ops.refNo")} htmlFor="ex-ref"><Input id="ex-ref" disabled={!!id} placeholder={t("catalog.autoSku")} value={v.refNo ?? ""} onChange={(e) => set({ refNo: e.target.value || undefined })} /></Field>
          <Field label={t("common.date")} htmlFor="ex-date"><Input id="ex-date" type="datetime-local" required value={v.date.slice(0, 16)} onChange={(e) => set({ date: `${e.target.value}:00` })} /></Field>
          <PickField label={t("finance.expenseFor")} value={v.forUserId ?? null} onChange={(x) => set({ forUserId: x })} options={(lookups?.users ?? []).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() }))} />
          <PickField label={t("finance.contact")} value={v.contactId ?? null} onChange={(x) => set({ contactId: x })} options={(contacts?.rows ?? []).map((c) => ({ value: c.id, label: c.businessName ? `${c.businessName} — ${c.name}` : c.name }))} />
          <Field label={t("finance.documentName")} htmlFor="ex-doc"><Input id="ex-doc" value={v.documents?.[0] ?? ""} onChange={(e) => set({ documents: e.target.value.trim() ? [e.target.value] : [] })} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={v.isRefund} onCheckedChange={(c) => set({ isRefund: c })} />{t("finance.isRefund")}</label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!rec} onCheckedChange={(c) => set({ recurring: c ? RECURRING : null })} />{t("finance.isRecurring")}
          </label>
        </div>
        {rec && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("finance.interval")}><NumInput label={t("finance.interval")} min={1} value={rec.interval} onChange={(n) => set({ recurring: { ...rec, interval: n } })} /></Field>
            <PickField label={t("finance.intervalType")} nullable={false} value={rec.intervalType} onChange={(x) => set({ recurring: { ...rec, intervalType: (x ?? "months") as typeof rec.intervalType } })}
              options={(["days", "months", "years"] as const).map((u) => ({ value: u, label: t(`catalog.${u}`) }))} />
            <Field label={t("finance.repetitionsLabel")} hint={t("finance.repetitionsHint")}><NumInput label={t("finance.repetitionsLabel")} nullable min={1} value={rec.repetitions} onChange={(n) => set({ recurring: { ...rec, repetitions: n } })} /></Field>
            {rec.intervalType !== "days" && (
              <Field label={t("finance.repeatOn")} hint={t("finance.repeatOnHint")}><NumInput label={t("finance.repeatOn")} nullable min={1} value={rec.repeatOn} onChange={(n) => set({ recurring: { ...rec, repeatOn: n } })} /></Field>
            )}
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("finance.amountSection")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("finance.amountBeforeTax")}><NumInput label={t("finance.amountBeforeTax")} value={v.amount} onChange={(n) => set({ amount: n })} /></Field>
            <PickField label={t("finance.applicableTax")} value={v.taxId ?? null} onChange={(x) => set({ taxId: x })} options={taxes.map((x) => ({ value: x.id, label: x.name }))} />
          </div>
          <Field label={t("common.note")} htmlFor="ex-note"><Textarea id="ex-note" value={v.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("common.subtotal")}</dt><dd><Money value={v.amount} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("products.tax")}</dt><dd><Money value={tax} /></dd></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>{t("common.total")}</dt><dd><Money value={v.isRefund ? -total : total} /></dd></div>
          </dl>
        </Section>

        <Section title={t("finance.paymentSection")}>
          {id ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">{t("finance.paymentsOnEdit")}</p>
              {can("expense.update") && <Button type="button" variant="outline" className="w-fit" onClick={() => setPaymentsOpen(true)}><BanknoteIcon />{t("ops.viewPayments")}</Button>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("ops.paidNow")}><NumInput label={t("ops.paidNow")} nullable value={pay.amount} onChange={(n) => setPay({ ...pay, amount: n })} /></Field>
              <PickField label={t("sales.paymentMethod")} nullable={false} value={pay.method} onChange={(x) => setPay({ ...pay, method: (x ?? "cash") as PaymentMethod })} options={methods.map((m) => ({ value: m, label: methodLabel(m, t, labels) }))} />
            </div>
          )}
        </Section>
      </div>

      <div data-print-hide className="fixed inset-x-0 bottom-0 z-20 border-t bg-background px-6 py-3 md:left-(--sidebar-width,0px)">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-2">
          <div className="text-sm font-semibold"><Money value={v.isRefund ? -total : total} /></div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link href="/expenses">{t("common.cancel")}</Link></Button>
            <Button type="submit" disabled={save.isPending || !v.categoryId || !(v.amount > 0)}>{t("common.save")}</Button>
          </div>
        </div>
      </div>
      <PaymentsDialog saleId={paymentsOpen && id ? id : null} mode="view" kind="expense" onClose={() => setPaymentsOpen(false)} />
    </form>
  );
}
