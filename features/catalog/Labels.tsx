"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { EyeIcon, PrinterIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { usePrint } from "@/features/pos/receipt/print";
import { useCrud } from "@/lib/data/hooks/catalog";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useProduct, useProducts } from "@/lib/data/hooks/products";
import { useSettings } from "@/lib/data/hooks/settings";
import type { ProductRow } from "@/lib/data/services/products";
import { expandLabels, isValidLabelQty, paginateLabels, type LabelSheet as Sheet } from "@/lib/domain/labels";
import { useFormat } from "@/lib/i18n/format";
import { Field, PickField } from "./formParts";
import { LabelPages, type LabelFields, type LabelItem } from "./LabelSheet";
import { ScrollFade } from "@/components/ui/scroll-fade";

type Row = { key: string; product: ProductRow; variationId: string; qty: number; packing: string; expiry: string; groupId: string | null };

const CUSTOM = "custom";
const today = () => new Date().toISOString().slice(0, 10);
const rowsFor = (p: ProductRow): Row[] => p.variations.map((v) => ({ key: v.id, product: p, variationId: v.id, qty: 1, packing: today(), expiry: "", groupId: null }));
const DEFAULT_FIELDS: LabelFields = {
  business: { on: true, size: 10 }, name: { on: true, size: 11 }, variation: { on: true, size: 9 },
  price: { on: true, size: 12 }, packing: { on: false, size: 8 }, expiry: { on: false, size: 8 },
};

export function Labels() {
  const t = useTranslations();
  const f = useFormat();
  const params = useSearchParams();
  const { data: settings } = useSettings();
  const { data: lookups } = useLookups();
  const sheetRows = useCrud("barcodeSettings").list.data?.rows;
  const sheets = useMemo(() => sheetRows ?? [], [sheetRows]);
  const [term, setTerm] = useState("");
  const found = useProducts({ search: term || undefined, pageSize: 8 }).data?.rows ?? [];
  const preselected = useProduct(params.get("product") ?? undefined).data;

  // Until the user edits the list it shows whatever the page was opened for (`?product=`).
  const [edited, setEdited] = useState<Row[] | null>(null);
  const rows = useMemo(() => edited ?? (preselected ? rowsFor(preselected) : []), [edited, preselected]);
  const setRows = (next: Row[]) => setEdited(next);
  const patch = (key: string, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const [fields, setFields] = useState<LabelFields>(DEFAULT_FIELDS);
  const [priceTax, setPriceTax] = useState<"inc" | "exc">("inc");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [custom, setCustom] = useState({ labelWidth: 2.25, labelHeight: 1.25, perRow: 1 });
  const [preview, setPreview] = useState(false);
  const { printing, print } = usePrint();

  const chosen = sheets.find((s) => s.id === sheetId) ?? sheets.find((s) => s.isDefault) ?? sheets[0];
  const sheet = useMemo<Sheet | null>(
    () => sheetId === CUSTOM
      ? { isContinuous: true, paperWidth: custom.labelWidth * custom.perRow, paperHeight: null, topMargin: 0, leftMargin: 0, rowDistance: 0, colDistance: 0, perSheet: null, ...custom }
      : (chosen ?? null),
    [sheetId, custom, chosen],
  );

  const valid = rows.length > 0 && rows.every((r) => isValidLabelQty(r.qty)) && !!sheet;
  const pages = useMemo(() => {
    if (!valid || !sheet) return [];
    const items = rows.map((r): { item: LabelItem; qty: number } => {
      const v = r.product.variations.find((x) => x.id === r.variationId)!;
      const price = r.groupId && v.groupPrices[r.groupId] != null ? v.groupPrices[r.groupId] : priceTax === "inc" ? v.sellPriceInc : v.sellPriceExc;
      return {
        qty: r.qty,
        item: {
          business: settings?.business.name ?? "", name: r.product.name, variation: v.name === "DUMMY" ? "" : v.name, price: f.money(price), sku: v.sku,
          packing: r.packing ? f.date(r.packing) : "", expiry: r.expiry ? f.date(r.expiry) : "",
        },
      };
    });
    return paginateLabels(expandLabels(items), sheet);
  }, [rows, valid, sheet, priceTax, settings, f]);

  const toggles: { key: keyof LabelFields; label: string }[] = [
    { key: "business", label: t("catalog.businessName") }, { key: "name", label: t("catalog.productName") }, { key: "variation", label: t("catalog.variationName") },
    { key: "price", label: t("catalog.price") }, { key: "packing", label: t("catalog.packingDate") }, { key: "expiry", label: t("catalog.expDate") },
  ];
  const labelsText = { packing: t("catalog.packingDate"), expiry: t("catalog.expDate") };
  const total = rows.reduce((s, r) => s + (isValidLabelQty(r.qty) ? r.qty : 0), 0);

  return (
    <div className="grid gap-4">
      <PageHeader
        title={t("nav.printLabels")} description={t("catalog.labelsDescription")}
        actions={
          <>
            <Button variant="outline" disabled={!valid} onClick={() => setPreview(true)}><EyeIcon />{t("catalog.preview")}</Button>
            <Button disabled={!valid} onClick={() => print("labels")}><PrinterIcon />{t("common.print")}</Button>
          </>
        }
      />

      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <Field label={t("catalog.addProducts")} htmlFor="label-search">
          <Input id="label-search" placeholder={t("sales.searchProductsShort")} value={term} onChange={(e) => setTerm(e.target.value)} />
        </Field>
        {term && found.map((p) => (
          <button key={p.id} type="button" className="rounded-md px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { setRows([...rows, ...rowsFor(p).filter((n) => !rows.some((r) => r.key === n.key))]); setTerm(""); }}>
            {p.name} <span className="text-muted-foreground">· {p.sku}</span>
          </button>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("catalog.noLabelRows")}</p>
        ) : (
          <ScrollFade className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("products.product")}</TableHead>
                  <TableHead className="w-28">{t("catalog.labelQty")}</TableHead>
                  <TableHead>{t("catalog.packingDate")}</TableHead>
                  {settings?.product.enableExpiry && <TableHead>{t("catalog.expDate")}</TableHead>}
                  <TableHead>{t("catalog.priceGroup")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const v = r.product.variations.find((x) => x.id === r.variationId);
                  return (
                    <TableRow key={r.key}>
                      <TableCell>{r.product.name}{v && v.name !== "DUMMY" && <span className="text-muted-foreground"> — {v.name}</span>}</TableCell>
                      <TableCell>
                        <Input aria-label={t("catalog.labelQty")} type="number" min={1} step={1} value={Number.isNaN(r.qty) ? "" : r.qty} aria-invalid={!isValidLabelQty(r.qty)} onChange={(e) => patch(r.key, { qty: e.target.value === "" ? Number.NaN : Number(e.target.value) })} />
                      </TableCell>
                      <TableCell><Input aria-label={t("catalog.packingDate")} type="date" value={r.packing} onChange={(e) => patch(r.key, { packing: e.target.value })} /></TableCell>
                      {settings?.product.enableExpiry && <TableCell><Input aria-label={t("catalog.expDate")} type="date" value={r.expiry} onChange={(e) => patch(r.key, { expiry: e.target.value })} /></TableCell>}
                      <TableCell>
                        <PickField label={t("catalog.priceGroup")} value={r.groupId} onChange={(id) => patch(r.key, { groupId: id })} options={(lookups?.priceGroups ?? []).map((g) => ({ value: g.id, label: g.name }))} className="[&>label]:sr-only" />
                      </TableCell>
                      <TableCell><Button variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><XIcon /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollFade>
        )}
        {rows.length > 0 && !valid && sheet && <p className="text-sm text-danger">{t("catalog.labelQtyInvalid")}</p>}
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <h3 className="font-semibold">{t("catalog.labelFields")}</h3>
          {toggles.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Switch aria-label={label} checked={fields[key].on} onCheckedChange={(on) => setFields({ ...fields, [key]: { ...fields[key], on } })} />
              <span className="flex-1 text-sm">{label}</span>
              <Input aria-label={`${label} ${t("catalog.fontSize")}`} type="number" min={6} max={30} className="w-20" value={fields[key].size} onChange={(e) => setFields({ ...fields, [key]: { ...fields[key], size: Number(e.target.value) || 8 } })} />
            </div>
          ))}
          <PickField
            label={t("catalog.priceShown")} nullable={false} value={priceTax} onChange={(x) => setPriceTax(x as "inc" | "exc")}
            options={[{ value: "inc", label: t("catalog.sellInc") }, { value: "exc", label: t("catalog.sellExc") }]}
          />
        </div>
        <div className="grid content-start gap-3">
          <h3 className="font-semibold">{t("catalog.sheet")}</h3>
          <PickField
            label={t("catalog.sheetPreset")} nullable={false} value={sheetId === CUSTOM ? CUSTOM : (chosen?.id ?? null)} onChange={(id) => setSheetId(id)}
            options={[...sheets.map((s) => ({ value: s.id, label: s.name })), { value: CUSTOM, label: t("catalog.customSheet") }]}
          />
          {sheetId === CUSTOM && (
            <div className="grid grid-cols-3 gap-3">
              {(["labelWidth", "labelHeight", "perRow"] as const).map((k) => (
                <Field key={k} label={t(`catalog.${k}`)}>
                  <Input aria-label={t(`catalog.${k}`)} type="number" min={k === "perRow" ? 1 : 0.5} step={k === "perRow" ? 1 : 0.125} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: Math.max(k === "perRow" ? 1 : 0.5, Number(e.target.value) || 1) })} />
                </Field>
              ))}
            </div>
          )}
          {sheet && <p className="text-sm text-muted-foreground">{t("catalog.labelsTotal", { count: total, pages: pages.length })}</p>}
        </div>
      </div>

      {preview && valid && sheet && (
        <div className="grid gap-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between"><h3 className="font-semibold">{t("catalog.preview")}</h3><Button variant="ghost" size="sm" onClick={() => setPreview(false)}>{t("common.close")}</Button></div>
          <div className="grid gap-4 overflow-auto rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            <div style={{ zoom: 0.7 }} className="grid justify-center gap-4"><LabelPages pages={pages} sheet={sheet} fields={fields} labels={labelsText} /></div>
          </div>
        </div>
      )}
      {printing === "labels" && valid && sheet && createPortal(<div data-print-root="labels"><LabelPages pages={pages} sheet={sheet} fields={fields} labels={labelsText} /></div>, document.body)}
    </div>
  );
}
