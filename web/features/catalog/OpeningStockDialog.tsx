"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useProduct, useProductMutations } from "@/lib/data/hooks/products";
import { useSettings } from "@/lib/data/hooks/settings";
import type { OpeningStockRow, ProductRow } from "@/lib/data/services/products";
import { catalogErrorMessage } from "./catalogError";
import { Field, NumInput, PickField } from "./formParts";

function Form({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { addOpeningStock } = useProductMutations();
  const first = product.variations[0];
  const blank = (): OpeningStockRow => ({ variationId: first.id, locationId: product.locationIds[0] ?? "", qty: 0, unitCost: first.purchasePriceExc, lotNo: "", mfgDate: null, expDate: null });
  const [rows, setRows] = useState<OpeningStockRow[]>([blank()]);
  const setRow = (i: number, p: Partial<OpeningStockRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const expiry = settings?.product.enableExpiry;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addOpeningStock.mutateAsync({ id: product.id, rows });
      toast.success(t("catalog.openingAdded"));
      onClose();
    } catch (err) {
      toast.error(catalogErrorMessage(err, t));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{t("catalog.openingFor", { name: product.name })}</DialogTitle></DialogHeader>
      <div className="grid max-h-[55vh] gap-3 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            {product.variations.length > 1 && (
              <PickField
                label={t("catalog.variationName")} nullable={false} value={r.variationId}
                onChange={(id) => setRow(i, { variationId: id ?? r.variationId, unitCost: product.variations.find((v) => v.id === id)?.purchasePriceExc ?? r.unitCost })}
                options={product.variations.map((v) => ({ value: v.id, label: v.name }))}
              />
            )}
            <PickField
              label={t("common.location")} nullable={false} value={r.locationId || null} onChange={(id) => setRow(i, { locationId: id ?? "" })}
              options={(lookups?.locations ?? []).filter((l) => product.locationIds.includes(l.id)).map((l) => ({ value: l.id, label: l.name }))}
            />
            <Field label={t("catalog.qty")}><NumInput label={t("catalog.qty")} value={r.qty} onChange={(n) => setRow(i, { qty: n })} /></Field>
            <Field label={t("catalog.unitCost")}><NumInput label={t("catalog.unitCost")} value={r.unitCost} onChange={(n) => setRow(i, { unitCost: n })} /></Field>
            <Field label={t("catalog.lotNo")}><Input aria-label={t("catalog.lotNo")} value={r.lotNo ?? ""} onChange={(e) => setRow(i, { lotNo: e.target.value })} /></Field>
            {expiry && (
              <>
                <Field label={t("catalog.mfgDate")}><Input aria-label={t("catalog.mfgDate")} type="date" value={r.mfgDate ?? ""} onChange={(e) => setRow(i, { mfgDate: e.target.value || null })} /></Field>
                <Field label={t("catalog.expDate")}><Input aria-label={t("catalog.expDate")} type="date" value={r.expDate ?? ""} onChange={(e) => setRow(i, { expDate: e.target.value || null })} /></Field>
              </>
            )}
            {rows.length > 1 && (
              <div className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}><XIcon />{t("common.remove")}</Button></div>
            )}
          </div>
        ))}
      </div>
      <div><Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, blank()])}><PlusIcon />{t("catalog.addLot")}</Button></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={addOpeningStock.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

export function OpeningStockDialog({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const { data: product } = useProduct(productId ?? undefined);
  return (
    <Dialog open={!!productId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">{product && productId && <Form key={productId} product={product} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
