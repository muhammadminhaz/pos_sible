"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useProductForm } from "@/lib/data/hooks/products";
import { useSettings } from "@/lib/data/hooks/settings";
import { useUI } from "@/lib/data/store/ui";
import type { ProductFormData } from "@/lib/data/services/products";
import { ProductForm } from "./ProductForm";
import { blankProduct } from "./productFormState";

/** Waits for lookups, settings and (when editing or duplicating) the product, so the form starts from complete state. */
export function ProductFormPage({ id }: { id?: string }) {
  const params = useSearchParams();
  const duplicateOf = id ? undefined : (params.get("duplicate") ?? undefined);
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const source = useProductForm(id ?? duplicateOf);
  const locationId = useUI((s) => s.locationId);
  if (!lookups || !settings || ((id || duplicateOf) && !source.data)) return <Skeleton className="h-96" />;

  let init: ProductFormData;
  if (source.data && id) {
    const { id: _id, ...rest } = source.data;
    void _id;
    init = { ...rest, customFields: [0, 1, 2, 3].map((i) => rest.customFields[i] ?? "") };
  } else if (source.data) {
    // A copy starts without ids or SKUs so the service numbers it fresh.
    const { id: _id, ...rest } = source.data;
    void _id;
    init = { ...rest, sku: "", customFields: [0, 1, 2, 3].map((i) => rest.customFields[i] ?? ""), variations: rest.variations.map(({ id: _v, ...v }) => (void _v, { ...v, sku: "" })) };
  } else {
    init = blankProduct(settings, lookups, locationId);
  }
  return <ProductForm key={id ?? duplicateOf ?? "new"} id={id} init={init} />;
}
