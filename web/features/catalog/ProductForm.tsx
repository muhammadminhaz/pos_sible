"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ImageIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useNextSku, useProductMutations } from "@/lib/data/hooks/products";
import { useSettings } from "@/lib/data/hooks/settings";
import { BARCODE_TYPES } from "@/lib/data/schemas";
import type { ProductFormData } from "@/lib/data/services/products";
import { fileToDataUrl } from "@/lib/image";
import { catalogErrorMessage } from "./catalogError";
import { Field, NumInput, PickField, Section } from "./formParts";
import { PricingSection } from "./PricingSection";

type After = "list" | "another" | "opening" | "prices";

export function ProductForm({ id, init }: { id?: string; init: ProductFormData }) {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { data: nextSku } = useNextSku();
  const { create, update } = useProductMutations();
  const [v, setV] = useState(init);
  const [after, setAfter] = useState<After>("list");
  const [formKey, setFormKey] = useState(0);
  const set = (p: Partial<ProductFormData>) => setV((s) => ({ ...s, ...p }));
  const ps = settings?.product;
  const subCategories = (lookups?.categories ?? []).filter((c) => c.parentId && c.parentId === v.categoryId);
  const subUnits = (lookups?.units ?? []).filter((u) => u.baseUnitId === v.unitId);

  // Arriving from "Save and add price-group prices": bring the pricing section into view.
  const focusPrices = params.get("focus") === "prices";
  useEffect(() => {
    if (focusPrices) document.getElementById("pricing")?.scrollIntoView({ block: "start" });
  }, [focusPrices]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const saved = id ? (await update.mutateAsync({ id, input: v }), { id }) : await create.mutateAsync(v);
      toast.success(t("catalog.productSaved"));
      if (after === "another") {
        setV(init);
        setFormKey((k) => k + 1);
        if (id) router.push("/products/new");
      } else if (after === "opening") router.push(`/products/${saved.id}?opening=1`);
      else if (after === "prices") router.push(`/products/${saved.id}/edit?focus=prices`);
      else router.push("/products");
    } catch (err) {
      toast.error(catalogErrorMessage(err, t));
    }
  };

  const onImage = async (file?: File) => {
    if (!file) return;
    try {
      set({ image: await fileToDataUrl(file) });
    } catch {
      toast.error(t("catalog.notAnImage"));
    }
  };

  const pending = create.isPending || update.isPending;
  const canOpening = can("product.opening_stock") && v.manageStock;
  const toggleIn = (key: "locationIds" | "subUnitIds", x: string, on: boolean) => set({ [key]: on ? [...v[key], x] : v[key].filter((y) => y !== x) });

  return (
    <form key={formKey} onSubmit={submit} className="grid gap-4 pb-24">
      <PageHeader title={id ? t("catalog.editProduct") : t("nav.addProduct")} description={t("catalog.formDescription")} />

      <Section title={t("catalog.basic")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("catalog.productName")} htmlFor="p-name"><Input id="p-name" required value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t("products.sku")} htmlFor="p-sku" hint={t("catalog.skuHint")}>
            <Input id="p-sku" value={v.sku} placeholder={nextSku} onChange={(e) => set({ sku: e.target.value })} />
          </Field>
          <PickField label={t("catalog.barcodeType")} nullable={false} value={v.barcodeType} onChange={(x) => set({ barcodeType: x as ProductFormData["barcodeType"] })} options={BARCODE_TYPES.map((b) => ({ value: b, label: b }))} />
          <PickField
            label={t("products.unit")} nullable={false} value={v.unitId || null} onChange={(x) => set({ unitId: x ?? "", subUnitIds: [] })}
            options={(lookups?.units ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.shortName})` }))}
          />
          {ps?.enableBrand && <PickField label={t("products.brand")} value={v.brandId} onChange={(x) => set({ brandId: x })} options={(lookups?.brands ?? []).map((b) => ({ value: b.id, label: b.name }))} />}
          {ps?.enableCategory && (
            <PickField
              label={t("products.category")} value={v.categoryId} onChange={(x) => set({ categoryId: x, subCategoryId: null })}
              options={(lookups?.categories ?? []).filter((c) => !c.parentId).map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          {ps?.enableCategory && ps.enableSubCategory && (
            <PickField label={t("catalog.subCategory")} value={v.subCategoryId} onChange={(x) => set({ subCategoryId: x })} options={subCategories.map((c) => ({ value: c.id, label: c.name }))} />
          )}
          {ps?.enableSecondaryUnit && (
            <PickField label={t("catalog.secondaryUnit")} value={v.secondaryUnitId} onChange={(x) => set({ secondaryUnitId: x })} options={(lookups?.units ?? []).filter((u) => u.id !== v.unitId).map((u) => ({ value: u.id, label: u.name }))} />
          )}
        </div>

        {ps?.enableSubUnits && subUnits.length > 0 && (
          <Field label={t("catalog.subUnits")}>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {subUnits.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm"><Checkbox checked={v.subUnitIds.includes(u.id)} onCheckedChange={(c) => toggleIn("subUnitIds", u.id, !!c)} />{u.name}</label>
              ))}
            </div>
          </Field>
        )}

        <Field label={t("products.locations")}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(lookups?.locations ?? []).map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-sm"><Checkbox checked={v.locationIds.includes(l.id)} onCheckedChange={(c) => toggleIn("locationIds", l.id, !!c)} />{l.name}</label>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-2 pt-6">
            <Switch id="p-stock" checked={v.manageStock} onCheckedChange={(x) => set({ manageStock: x })} />
            <Label htmlFor="p-stock">{t("catalog.manageStock")}</Label>
          </div>
          {v.manageStock && (
            <Field label={t("catalog.alertQty")} hint={t("catalog.alertQtyHint")}><NumInput label={t("catalog.alertQty")} nullable value={v.alertQty} onChange={(x) => set({ alertQty: x })} /></Field>
          )}
        </div>

        <Field label={t("catalog.description")} htmlFor="p-desc"><Textarea id="p-desc" value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("products.image")} htmlFor="p-image" hint={ps?.imageRequired ? t("catalog.imageRequired") : undefined}>
            <div className="flex items-center gap-3">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.image ? <img src={v.image} alt="" className="size-full object-cover" /> : <ImageIcon className="size-5" />}
              </span>
              <Input id="p-image" type="file" accept="image/*" required={!!ps?.imageRequired && !v.image} onChange={(e) => onImage(e.target.files?.[0])} />
              {v.image && <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => set({ image: null })}><XIcon /></Button>}
            </div>
          </Field>
          <Field label={t("catalog.brochure")} htmlFor="p-brochure"><Input id="p-brochure" value={v.brochure ?? ""} onChange={(e) => set({ brochure: e.target.value || null })} /></Field>
        </div>
      </Section>

      <Section title={t("catalog.advanced")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ps?.enableExpiry && (
            <>
              <Field label={t("catalog.expiryPeriod")}><NumInput label={t("catalog.expiryPeriod")} nullable value={v.expiryPeriod} onChange={(x) => set({ expiryPeriod: x, expiryPeriodType: x == null ? null : (v.expiryPeriodType ?? "months") })} /></Field>
              <PickField
                label={t("catalog.expiryPeriodType")} nullable={false} value={v.expiryPeriodType ?? "months"} onChange={(x) => set({ expiryPeriodType: x as "days" | "months" })}
                options={[{ value: "days", label: t("catalog.days") }, { value: "months", label: t("catalog.months") }]}
              />
            </>
          )}
          {ps?.enableWarranty && <PickField label={t("catalog.warranty")} value={v.warrantyId} onChange={(x) => set({ warrantyId: x })} options={(lookups?.warranties ?? []).map((w) => ({ value: w.id, label: w.name }))} />}
          <Field label={t("catalog.weight")} htmlFor="p-weight"><Input id="p-weight" value={v.weight} onChange={(e) => set({ weight: e.target.value })} /></Field>
          <Field label={t("catalog.prepTime")}><NumInput label={t("catalog.prepTime")} nullable value={v.prepTimeMinutes} onChange={(x) => set({ prepTimeMinutes: x })} /></Field>
          {ps?.enableRacks && <Field label={t("catalog.rack")} htmlFor="p-rack"><Input id="p-rack" value={v.rack} onChange={(e) => set({ rack: e.target.value })} /></Field>}
          {ps?.enableRow && <Field label={t("catalog.row")} htmlFor="p-row"><Input id="p-row" value={v.row} onChange={(e) => set({ row: e.target.value })} /></Field>}
          {ps?.enablePosition && <Field label={t("catalog.position")} htmlFor="p-pos"><Input id="p-pos" value={v.position} onChange={(e) => set({ position: e.target.value })} /></Field>}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={v.enableSerial} onCheckedChange={(x) => set({ enableSerial: x })} />{t("catalog.enableSerial")}</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={v.notForSale} onCheckedChange={(x) => set({ notForSale: x })} />{t("products.notForSelling")}</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={v.active} onCheckedChange={(x) => set({ active: x })} />{t("common.active")}</label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Field key={i} label={t("catalog.customField", { n: i + 1 })} htmlFor={`p-cf-${i}`}>
              <Input id={`p-cf-${i}`} value={v.customFields[i] ?? ""} onChange={(e) => set({ customFields: [0, 1, 2, 3].map((j) => (j === i ? e.target.value : (v.customFields[j] ?? ""))) })} />
            </Field>
          ))}
        </div>
      </Section>

      <PricingSection value={v} onChange={set} />

      <div data-print-hide className="fixed inset-x-0 bottom-0 z-20 border-t bg-background px-6 py-3 md:left-(--sidebar-width,0px)">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" variant="ghost"><Link href="/products">{t("common.cancel")}</Link></Button>
          {!id && <Button type="submit" variant="outline" disabled={pending} onClick={() => setAfter("another")}>{t("catalog.saveAddAnother")}</Button>}
          {canOpening && <Button type="submit" variant="outline" disabled={pending} onClick={() => setAfter("opening")}>{t("catalog.saveAddOpening")}</Button>}
          <Button type="submit" variant="outline" disabled={pending} onClick={() => setAfter("prices")}>{t("catalog.saveAddPrices")}</Button>
          <Button type="submit" disabled={pending} onClick={() => setAfter("list")}>{t("common.save")}</Button>
        </div>
      </div>
    </form>
  );
}
