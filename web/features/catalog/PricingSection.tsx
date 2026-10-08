"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useProducts } from "@/lib/data/hooks/products";
import type { ProductFormData, VariationInput } from "@/lib/data/services/products";
import { recalcPrices, type PriceField } from "@/lib/domain/pricing";
import { combinations } from "@/lib/domain/variations";
import { Field, NumInput, PickField, Section } from "./formParts";
import { blankVariation } from "./productFormState";
import { ScrollFade } from "@/components/ui/scroll-fade";

type Props = { value: ProductFormData; onChange: (patch: Partial<ProductFormData>) => void };

const PRICE_FIELDS: { field: PriceField; label: string }[] = [
  { field: "purchasePriceExc", label: "purchaseExc" },
  { field: "purchasePriceInc", label: "purchaseInc" },
  { field: "margin", label: "margin" },
  { field: "sellPriceExc", label: "sellExc" },
  { field: "sellPriceInc", label: "sellInc" },
];

function GroupPrices({ v, onChange }: { v: VariationInput; onChange: (v: VariationInput) => void }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const groups = (lookups?.priceGroups ?? []).filter((g) => g.active);
  if (!groups.length) return null;
  return (
    <>
      {groups.map((g) => (
        <Field key={g.id} label={g.name}>
          <NumInput
            label={`${g.name} ${t("catalog.price")}`} nullable value={v.groupPrices[g.id] ?? null}
            onChange={(n) => {
              const next = { ...v.groupPrices };
              if (n == null) delete next[g.id];
              else next[g.id] = n;
              onChange({ ...v, groupPrices: next });
            }}
          />
        </Field>
      ))}
    </>
  );
}

/** Single and combo products: one set of prices. */
function PriceGrid({ v, rate, onChange }: { v: VariationInput; rate: number; onChange: (v: VariationInput) => void }) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {PRICE_FIELDS.map(({ field, label }) => (
        <Field key={field} label={t(`catalog.${label}`)}>
          <NumInput label={t(`catalog.${label}`)} value={v[field]} onChange={(n) => onChange({ ...v, ...recalcPrices({ ...v, [field]: n }, field, rate) })} />
        </Field>
      ))}
      <GroupPrices v={v} onChange={onChange} />
    </div>
  );
}

function VariationBuilder({ value, onChange, rate, margin }: Props & { rate: number; margin: number }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const templates = lookups?.variationTemplates ?? [];
  const groups = (lookups?.priceGroups ?? []).filter((g) => g.active);
  const [dims, setDims] = useState<{ templateId: string | null; values: string[] }[]>([
    { templateId: value.variationTemplateId, values: [] },
    { templateId: null, values: [] },
  ]);
  const setDim = (i: number, patch: Partial<(typeof dims)[number]>) => setDims(dims.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const rows = value.variations;
  const setRow = (i: number, v: VariationInput) => onChange({ variations: rows.map((r, j) => (j === i ? v : r)) });

  const generate = () => {
    const names = combinations(dims.map((d) => d.values));
    const template = rows[0] ?? blankVariation(margin);
    const fresh = names
      .filter((n) => !rows.some((r) => r.name === n))
      .map((n) => ({ ...blankVariation(template.margin, n), purchasePriceExc: template.purchasePriceExc, purchasePriceInc: template.purchasePriceInc, sellPriceExc: template.sellPriceExc, sellPriceInc: template.sellPriceInc }));
    onChange({ variations: [...rows, ...fresh], variationTemplateId: dims[0].templateId });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {dims.map((d, i) => {
          const tpl = templates.find((x) => x.id === d.templateId);
          return (
            <div key={i} className="grid content-start gap-2 rounded-lg border p-3">
              <PickField
                label={i === 0 ? t("catalog.variationTemplate") : t("catalog.secondTemplate")} value={d.templateId}
                options={templates.filter((x) => x.id !== dims[1 - i].templateId).map((x) => ({ value: x.id, label: x.name }))}
                onChange={(id) => setDim(i, { templateId: id, values: [] })}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {tpl?.values.map((val) => (
                  <label key={val} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={d.values.includes(val)} onCheckedChange={(c) => setDim(i, { values: c ? [...d.values, val] : d.values.filter((x) => x !== val) })} />
                    {val}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!dims.some((d) => d.values.length)} onClick={generate}><SparklesIcon />{t("catalog.generateVariations")}</Button>
        <Button type="button" variant="outline" onClick={() => onChange({ variations: [...rows, blankVariation(rows[0]?.margin ?? margin, "")] })}><PlusIcon />{t("catalog.addVariationRow")}</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("catalog.noVariationRows")}</p>
      ) : (
        <ScrollFade className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("catalog.variationName")}</TableHead>
                <TableHead>{t("products.sku")}</TableHead>
                {PRICE_FIELDS.map((p) => <TableHead key={p.field} className="text-right">{t(`catalog.${p.label}`)}</TableHead>)}
                {groups.map((g) => <TableHead key={g.id} className="text-right">{g.name}</TableHead>)}
                <TableHead className="w-10 whitespace-nowrap">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id ?? `new-${i}`}>
                  <TableCell><Input aria-label={t("catalog.variationName")} required value={r.name} onChange={(e) => setRow(i, { ...r, name: e.target.value })} className="min-w-32" /></TableCell>
                  <TableCell><Input aria-label={t("products.sku")} value={r.sku} placeholder={t("catalog.autoSku")} onChange={(e) => setRow(i, { ...r, sku: e.target.value })} className="min-w-28" /></TableCell>
                  {PRICE_FIELDS.map(({ field, label }) => (
                    <TableCell key={field}>
                      <NumInput label={`${r.name} ${t(`catalog.${label}`)}`} value={r[field]} className="min-w-24 text-right" onChange={(n) => setRow(i, { ...r, ...recalcPrices({ ...r, [field]: n }, field, rate) })} />
                    </TableCell>
                  ))}
                  {groups.map((g) => (
                    <TableCell key={g.id}>
                      <NumInput
                        label={`${r.name} ${g.name}`} nullable value={r.groupPrices[g.id] ?? null} className="min-w-24 text-right"
                        onChange={(n) => {
                          const next = { ...r.groupPrices };
                          if (n == null) delete next[g.id];
                          else next[g.id] = n;
                          setRow(i, { ...r, groupPrices: next });
                        }}
                      />
                    </TableCell>
                  ))}
                  <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => onChange({ variations: rows.filter((_, j) => j !== i) })}><Trash2Icon /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollFade>
      )}
    </div>
  );
}

function ComboBuilder({ value, onChange, rate }: Props & { rate: number }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { data: all } = useProducts({ pageSize: -1 });
  const [term, setTerm] = useState("");
  const v = value.variations[0];
  const items = v.comboItems;
  // Every non-combo variation, with the product it belongs to, so items can show a readable name and cost.
  const options = useMemo(
    () => (all?.rows ?? []).filter((p) => p.type !== "combo").flatMap((p) => p.variations.map((x) => ({ id: x.id, label: x.name === "DUMMY" ? p.name : `${p.name} — ${x.name}`, unitId: p.unitId, cost: x.purchasePriceExc }))),
    [all],
  );
  const byId = new Map(options.map((o) => [o.id, o]));
  const found = options.filter((o) => term && !items.some((i) => i.variationId === o.id) && o.label.toLowerCase().includes(term.toLowerCase())).slice(0, 8);
  const setItems = (comboItems: VariationInput["comboItems"]) => onChange({ variations: [{ ...v, comboItems }] });
  const total = items.reduce((s, i) => s + i.qty * (byId.get(i.variationId)?.cost ?? 0), 0);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="combo-search">{t("catalog.comboItems")}</Label>
        <Input id="combo-search" placeholder={t("sales.searchProductsShort")} value={term} onChange={(e) => setTerm(e.target.value)} />
        {found.map((o) => (
          <button key={o.id} type="button" className="rounded-md px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { setItems([...items, { variationId: o.id, qty: 1, unitId: o.unitId }]); setTerm(""); }}>
            {o.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("catalog.noComboItems")}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((it, i) => (
            <li key={it.variationId} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="min-w-40 flex-1 font-medium">{byId.get(it.variationId)?.label ?? it.variationId}</span>
              <NumInput label={t("catalog.qty")} value={it.qty} min={0} className="w-24" onChange={(n) => setItems(items.map((x, j) => (j === i ? { ...x, qty: n } : x)))} />
              <span className="text-muted-foreground">{lookups?.units.find((u) => u.id === it.unitId)?.shortName}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setItems(items.filter((_, j) => j !== i))}><XIcon /></Button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ variations: [{ ...v, ...recalcPrices({ ...v, purchasePriceExc: Math.round(total * 100) / 100 }, "purchasePriceExc", rate) }] })}>
            {t("catalog.useItemsCost")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function PricingSection({ value, onChange }: Props) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const rate = lookups?.taxRates.find((x) => x.id === value.taxId)?.rate ?? 0;
  const first = value.variations[0];
  // Remembered so a variable product's new rows start from the business's default margin, not 0.
  const [defaultMargin] = useState(first?.margin ?? 0);

  const setType = (type: ProductFormData["type"]) => {
    if (type === value.type) return;
    if (type === "variable") onChange({ type, variations: [] });
    else onChange({ type, variations: [{ ...(first ?? blankVariation(defaultMargin)), name: "DUMMY", sku: "", comboItems: [] }] });
  };
  // Changing the tax re-derives every price that includes it, starting from the purchase price excluding tax.
  const setTax = (taxId: string | null) => {
    const r = lookups?.taxRates.find((x) => x.id === taxId)?.rate ?? 0;
    onChange({ taxId, variations: value.variations.map((v) => ({ ...v, ...recalcPrices(v, "purchasePriceExc", r) })) });
  };

  return (
    <Section id="pricing" title={t("catalog.pricing")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <PickField label={t("products.tax")} value={value.taxId} options={(lookups?.taxRates ?? []).map((x) => ({ value: x.id, label: x.name }))} onChange={setTax} />
        <PickField
          label={t("catalog.taxType")} nullable={false} value={value.taxType} onChange={(x) => onChange({ taxType: x as "inclusive" | "exclusive" })}
          options={[{ value: "exclusive", label: t("catalog.exclusive") }, { value: "inclusive", label: t("catalog.inclusive") }]}
        />
        <PickField
          label={t("products.type")} nullable={false} value={value.type} onChange={(x) => setType(x as ProductFormData["type"])}
          options={(["single", "variable", "combo"] as const).map((x) => ({ value: x, label: t(`products.${x}`) }))}
        />
      </div>
      {value.type === "variable" ? (
        <VariationBuilder value={value} onChange={onChange} rate={rate} margin={defaultMargin} />
      ) : (
        <>
          {value.type === "combo" && <ComboBuilder value={value} onChange={onChange} rate={rate} />}
          {first && <PriceGrid v={first} rate={rate} onChange={(v) => onChange({ variations: [v] })} />}
        </>
      )}
    </Section>
  );
}
