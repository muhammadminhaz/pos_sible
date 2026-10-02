"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { Field, NumInput, PickField, Section } from "@/features/catalog/formParts";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePurchaseMutations } from "@/lib/data/hooks/operations";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PaymentMethod } from "@/lib/data/schemas";
import type { PurchaseInput, PurchaseLineInput } from "@/lib/data/services/purchases";
import { marginFromPrices } from "@/lib/domain/pricing";
import { lineTotals, orderTotals } from "@/lib/domain/totals";
import { roundMoney } from "@/lib/domain/money";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { ContactFormDialog } from "./ContactForm";
import { opsErrorMessage } from "./opsError";
import { PurchaseImportButton } from "./PurchaseImportDialog";
import type { PurchaseImportRow } from "@/lib/data/services/purchaseImport";
import { ProductPicker, variationLabel } from "./ProductPicker";

export type PurchaseRowState = PurchaseLineInput & { name: string; sku: string; unitName: string; updatePrice: boolean; currentSellInc: number };

const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;

export function PurchaseForm({ id, init, rows: initRows }: { id?: string; init: PurchaseInput; rows: PurchaseRowState[] }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { data: suppliers } = useContacts({ type: "supplier", pageSize: -1 });
  const { save } = usePurchaseMutations();
  const [v, setV] = useState<PurchaseInput>(init);
  const [rows, setRows] = useState<PurchaseRowState[]>(initRows);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [pay, setPay] = useState<{ amount: number | null; method: PaymentMethod }>({ amount: null, method: "cash" });
  const set = (p: Partial<PurchaseInput>) => setV((s) => ({ ...s, ...p }));
  const setRow = (i: number, p: Partial<PurchaseRowState>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const expiry = settings?.product.enableExpiry;
  const showStatus = settings?.purchase.enablePurchaseStatus !== false;
  const showLot = settings?.purchase.enableLotNumber !== false;
  const showPriceUpdate = settings?.purchase.editProductPriceFromPurchase !== false;
  const showTax = settings?.tax.enableInlineTax !== false;
  const taxes = lookups?.taxRates ?? [];
  const rate = (taxId: string | null) => taxes.find((x) => x.id === taxId)?.rate ?? 0;

  const totals = useMemo(
    () => orderTotals({
      lines: rows.map((r) => ({ qty: r.qty, unitPrice: r.unitPrice, taxRate: rate(r.taxId), taxType: "exclusive" as const, discount: r.discount ?? undefined })),
      discount: v.discount ?? undefined, orderTaxRate: rate(v.orderTaxId), shipping: v.shipping.charges, additionalExpenses: v.additionalExpenses.map((e) => e.amount),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, v.discount, v.orderTaxId, v.shipping.charges, v.additionalExpenses, taxes],
  );

  const addProduct = (p: Parameters<React.ComponentProps<typeof ProductPicker>["onPick"]>[0], variation: Parameters<React.ComponentProps<typeof ProductPicker>["onPick"]>[1]) => {
    const at = rows.findIndex((r) => r.variationId === variation.id);
    if (at >= 0) return setRow(at, { qty: rows[at].qty + 1 });
    setRows([...rows, {
      productId: p.id, variationId: variation.id, qty: 1, unitPrice: variation.purchasePriceExc, discount: null, taxId: p.taxId, lotNo: "", mfgDate: null, expDate: null,
      sellPriceInc: null, name: variationLabel(p, variation), sku: variation.sku, unitName: p.unitName, updatePrice: false, currentSellInc: variation.sellPriceInc,
    }]);
  };

  /** Imported rows join the table; a variation already there just gets more quantity. */
  const addImported = (imported: PurchaseImportRow[]) => {
    setRows((current) => {
      const next = [...current];
      for (const r of imported) {
        const at = next.findIndex((x) => x.variationId === r.variationId && x.unitPrice === r.unitPrice && (x.lotNo ?? "") === r.lotNo);
        if (at >= 0) next[at] = { ...next[at], qty: next[at].qty + r.qty };
        else next.push({
          productId: r.productId, variationId: r.variationId, qty: r.qty, unitPrice: r.unitPrice, discount: null, taxId: r.taxId, lotNo: r.lotNo, mfgDate: r.mfgDate, expDate: r.expDate,
          sellPriceInc: null, name: r.name, sku: r.sku, unitName: r.unitName, updatePrice: false, currentSellInc: r.currentSellInc,
        });
      }
      return next;
    });
    toast.success(t("ops.importAdded", { count: imported.length }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payments = !id && pay.amount && pay.amount > 0 ? [{ method: pay.method, amount: pay.amount }] : undefined;
    try {
      const r = await save.mutateAsync({
        ...v, id, payments,
        lines: rows.map(({ productId, variationId, qty, unitPrice, discount, taxId, lotNo, mfgDate, expDate, sellPriceInc, updatePrice }) => ({ productId, variationId, qty, unitPrice, discount, taxId, lotNo, mfgDate, expDate, sellPriceInc: updatePrice ? sellPriceInc : null })),
      });
      toast.success(t("ops.purchaseSaved", { refNo: r.refNo }));
      router.push(`/purchases/${r.id}`);
    } catch (err) {
      toast.error(opsErrorMessage(err, t));
    }
  };

  const location = lookups?.locations.find((l) => l.id === v.locationId);
  const methods = tillMethods(location?.paymentMethods ?? ["cash"], settings?.customLabels.payments ?? []);
  const dateValue = v.date.slice(0, 16);

  return (
    <form onSubmit={submit} className="grid gap-4 pb-24">
      <PageHeader title={id ? t("nav.editPurchase") : t("nav.addPurchase")} description={t("ops.purchaseFormDescription")} />

      <Section title={t("ops.purchaseDetails")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-end gap-2">
            <PickField label={t("ops.supplier")} nullable={false} value={v.contactId || null} onChange={(x) => set({ contactId: x ?? "" })} className="min-w-0 flex-1 [&_button]:min-w-0 [&_[data-slot=select-value]]:truncate"
              options={(suppliers?.rows ?? []).map((c) => ({ value: c.id, label: c.businessName ? `${c.businessName} — ${c.name}` : c.name }))} />
            <Button type="button" variant="outline" size="icon" aria-label={t("ops.addSupplier")} onClick={() => setSupplierDialog(true)}><PlusIcon /></Button>
          </div>
          <PickField label={t("common.location")} nullable={false} value={v.locationId || null} onChange={(x) => set({ locationId: x ?? "" })} options={(lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} />
          <Field label={t("common.date")} htmlFor="pu-date"><Input id="pu-date" type="datetime-local" required value={dateValue} onChange={(e) => set({ date: `${e.target.value}:00` })} /></Field>
          <Field label={t("ops.refNo")} htmlFor="pu-ref"><Input id="pu-ref" disabled={!!id} placeholder={t("catalog.autoSku")} value={v.refNo ?? ""} onChange={(e) => set({ refNo: e.target.value || undefined })} /></Field>
          {showStatus && (
            <PickField label={t("ops.purchaseStatus")} nullable={false} value={v.status} onChange={(x) => set({ status: x as PurchaseInput["status"] })}
              options={(["received", "pending", "ordered"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          )}
          <Field label={t("ops.payTerm")}>
            <div className="flex gap-2">
              <NumInput label={t("ops.payTerm")} nullable value={v.payTerm?.number ?? null} onChange={(n) => set({ payTerm: n == null ? null : { number: n, type: v.payTerm?.type ?? "days" } })} />
              <PickField label={t("ops.payTermType")} nullable={false} value={v.payTerm?.type ?? "days"} onChange={(x) => v.payTerm && set({ payTerm: { ...v.payTerm, type: x as "days" | "months" } })} className="min-w-28 [&>label]:sr-only"
                options={[{ value: "days", label: t("catalog.days") }, { value: "months", label: t("catalog.months") }]} />
            </div>
          </Field>
          <Field label={t("sales.attachDocument")} htmlFor="pu-doc"><Input id="pu-doc" type="file" onChange={(e) => set({ documents: e.target.files?.[0] ? [e.target.files[0].name] : [] })} />{v.documents[0] && <span className="text-xs text-muted-foreground">{v.documents[0]}</span>}</Field>
          <Field label={t("ops.exchangeRate")}><NumInput label={t("ops.exchangeRate")} min={0.0001} value={v.exchangeRate} onChange={(n) => set({ exchangeRate: n })} /></Field>
        </div>
      </Section>

      <Section title={t("ops.items")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1"><ProductPicker onPick={addProduct} /></div>
          <PurchaseImportButton onAdd={addImported} />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ops.noItems")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("products.product")}</TableHead>
                  <TableHead className="w-24">{t("catalog.qty")}</TableHead>
                  <TableHead className="w-32">{t("ops.unitCostExc")}</TableHead>
                  <TableHead className="w-24">{t("ops.discountPct")}</TableHead>
                  {showTax && <TableHead className="w-40">{t("products.tax")}</TableHead>}
                  <TableHead className="text-right">{t("common.subtotal")}</TableHead>
                  {showLot && <TableHead className="w-28">{t("catalog.lotNo")}</TableHead>}
                  {expiry && <TableHead className="w-36">{t("catalog.mfgDate")}</TableHead>}
                  {expiry && <TableHead className="w-36">{t("catalog.expDate")}</TableHead>}
                  {showPriceUpdate && <TableHead className="w-48">{t("ops.updateSellPrice")}</TableHead>}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const lt = lineTotals({ qty: r.qty, unitPrice: r.unitPrice, taxRate: rate(r.taxId), taxType: "exclusive", discount: r.discount ?? undefined });
                  const margin = r.sellPriceInc != null ? marginFromPrices(r.unitPrice, roundMoney(r.sellPriceInc / (1 + rate(r.taxId) / 100))) : 0;
                  return (
                    <TableRow key={r.variationId}>
                      <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground tabular">{r.sku}</div></TableCell>
                      <TableCell><NumInput label={`${r.name} ${t("catalog.qty")}`} value={r.qty} min={0} onChange={(n) => setRow(i, { qty: n })} /></TableCell>
                      <TableCell><NumInput label={`${r.name} ${t("ops.unitCostExc")}`} value={r.unitPrice} onChange={(n) => setRow(i, { unitPrice: n })} /></TableCell>
                      <TableCell><NumInput label={`${r.name} ${t("ops.discountPct")}`} value={r.discount?.amount ?? 0} onChange={(n) => setRow(i, { discount: n > 0 ? { type: "percentage", amount: n } : null })} /></TableCell>
                      {showTax && (
                        <TableCell>
                        <PickField label={`${r.name} ${t("products.tax")}`} value={r.taxId} onChange={(x) => setRow(i, { taxId: x })} options={taxes.map((x) => ({ value: x.id, label: x.name }))} className="[&>label]:sr-only" />
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular">{f.amount(lt.subtotal)}</TableCell>
                      {showLot && <TableCell><Input aria-label={`${r.name} ${t("catalog.lotNo")}`} value={r.lotNo ?? ""} onChange={(e) => setRow(i, { lotNo: e.target.value })} /></TableCell>}
                      {expiry && <TableCell><Input aria-label={`${r.name} ${t("catalog.mfgDate")}`} type="date" value={r.mfgDate ?? ""} onChange={(e) => setRow(i, { mfgDate: e.target.value || null })} /></TableCell>}
                      {expiry && <TableCell><Input aria-label={`${r.name} ${t("catalog.expDate")}`} type="date" value={r.expDate ?? ""} onChange={(e) => setRow(i, { expDate: e.target.value || null })} /></TableCell>}
                      {showPriceUpdate && (
                        <TableCell>
                          <div className="grid gap-1">
                            <label className="flex items-center gap-2 text-xs"><Checkbox checked={r.updatePrice} onCheckedChange={(c) => setRow(i, { updatePrice: !!c, sellPriceInc: c ? (r.sellPriceInc ?? r.currentSellInc) : null })} />{t("ops.updateSellPrice")}</label>
                            {r.updatePrice && (
                              <div className="flex items-center gap-1">
                                <NumInput label={`${r.name} ${t("catalog.sellInc")}`} value={r.sellPriceInc ?? null} nullable onChange={(n) => setRow(i, { sellPriceInc: n })} />
                                <span className="text-xs text-muted-foreground tabular whitespace-nowrap">{f.number(margin)}%</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2Icon /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("ops.charges")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("sales.discountAmount")}>
              <div className="flex gap-2">
                <NumInput label={t("sales.discountAmount")} value={v.discount?.amount ?? 0} onChange={(n) => set({ discount: n > 0 ? { type: v.discount?.type ?? "fixed", amount: n } : null })} />
                <PickField label={t("sales.discountAmount")} nullable={false} value={v.discount?.type ?? "fixed"} onChange={(x) => v.discount && set({ discount: { ...v.discount, type: x as "fixed" | "percentage" } })} className="min-w-28 [&>label]:sr-only"
                  options={[{ value: "fixed", label: t("sales.fixed") }, { value: "percentage", label: t("sales.percentage") }]} />
              </div>
            </Field>
            <PickField label={t("ops.orderTax")} value={v.orderTaxId} onChange={(x) => set({ orderTaxId: x })} options={taxes.map((x) => ({ value: x.id, label: x.name }))} />
            <Field label={t("ops.shippingCharges")}><NumInput label={t("ops.shippingCharges")} value={v.shipping.charges} onChange={(n) => set({ shipping: { ...v.shipping, charges: n } })} /></Field>
            <Field label={t("ops.shippingDetails")} htmlFor="pu-ship"><Input id="pu-ship" value={v.shipping.details} onChange={(e) => set({ shipping: { ...v.shipping, details: e.target.value } })} /></Field>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("ops.additionalExpenses")}</span>
              {v.additionalExpenses.length < 4 && <Button type="button" variant="outline" size="sm" onClick={() => set({ additionalExpenses: [...v.additionalExpenses, { name: "", amount: 0 }] })}><PlusIcon />{t("common.add")}</Button>}
            </div>
            {v.additionalExpenses.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label={t("catalog.name")} placeholder={t("catalog.name")} value={x.name} onChange={(e) => set({ additionalExpenses: v.additionalExpenses.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
                <NumInput label={t("sales.expenseAmount")} value={x.amount} className="w-32" onChange={(n) => set({ additionalExpenses: v.additionalExpenses.map((y, j) => (j === i ? { ...y, amount: n } : y)) })} />
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => set({ additionalExpenses: v.additionalExpenses.filter((_, j) => j !== i) })}><XIcon /></Button>
              </div>
            ))}
          </div>
          <Field label={t("common.note")} htmlFor="pu-notes"><Textarea id="pu-notes" value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </Section>

        <Section title={t("ops.summary")}>
          <dl className="grid gap-2 text-sm">
            {([["common.subtotal", totals.linesTotal], ["ops.discountLine", -totals.discount], ["ops.orderTax", totals.orderTax], ["ops.shippingCharges", totals.shipping], ["ops.additionalExpenses", totals.additional]] as const).map(([k, n]) => (
              <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{t(k)}</dt><dd className="tabular">{f.amount(n)}</dd></div>
            ))}
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>{t("common.total")}</dt><dd><Money value={totals.total} /></dd></div>
          </dl>
          {!id && (
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
              <Field label={t("ops.paidNow")}><NumInput label={t("ops.paidNow")} nullable value={pay.amount} onChange={(n) => setPay({ ...pay, amount: n })} /></Field>
              <PickField label={t("sales.paymentMethod")} nullable={false} value={pay.method} onChange={(x) => setPay({ ...pay, method: (x ?? "cash") as PaymentMethod })} options={methods.map((m) => ({ value: m, label: methodLabel(m, t, settings?.customLabels.payments ?? []) }))} />
            </div>
          )}
        </Section>
      </div>

      <div data-print-hide className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-6 py-3 backdrop-blur md:left-(--sidebar-width,0px)">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">{t("ops.itemsTotal", { count: totals.itemsCount })} · <span className="font-semibold text-foreground"><Money value={totals.total} /></span></div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link href="/purchases">{t("common.cancel")}</Link></Button>
            <Button type="submit" disabled={save.isPending || rows.length === 0 || !v.contactId}>{t("common.save")}</Button>
          </div>
        </div>
      </div>
      <ContactFormDialog editId={supplierDialog ? "new" : null} defaultType="supplier" onClose={() => setSupplierDialog(false)} onSaved={(cid) => set({ contactId: cid })} />
    </form>
  );
}

export { stamp as nowStamp };
