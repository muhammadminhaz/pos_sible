"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePurchaseForm } from "@/lib/data/hooks/operations";
import { useProducts } from "@/lib/data/hooks/products";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PurchaseInput } from "@/lib/data/services/purchases";
import { useUI } from "@/lib/data/store/ui";
import { nowStamp, PurchaseForm, type PurchaseRowState } from "./PurchaseForm";
import { variationLabel } from "./ProductPicker";

export function PurchaseFormPage({ id }: { id?: string }) {
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const form = usePurchaseForm(id);
  const products = useProducts({ pageSize: -1 });
  const locationId = useUI((s) => s.locationId);
  if (!lookups || !settings || !products.data || (id && !form.data)) return <Skeleton className="h-96" />;

  const blank: PurchaseInput = {
    locationId: locationId === "all" ? (lookups.locations[0]?.id ?? "") : locationId, contactId: "", date: nowStamp(new Date()), status: "received", lines: [], discount: null, orderTaxId: null,
    shipping: { charges: 0, details: "" }, additionalExpenses: [], exchangeRate: 1, payTerm: null, notes: "", documents: [],
  };
  const init = form.data ?? blank;
  const rows: PurchaseRowState[] = init.lines.flatMap((l) => {
    const p = products.data!.rows.find((x) => x.id === l.productId);
    const v = p?.variations.find((x) => x.id === l.variationId);
    return p && v ? [{ ...l, name: variationLabel(p, v), sku: v.sku, unitName: p.unitName, updatePrice: l.sellPriceInc != null, currentSellInc: v.sellPriceInc }] : [];
  });
  return <PurchaseForm key={id ?? "new"} id={id} init={init} rows={rows} />;
}
