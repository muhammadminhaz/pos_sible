"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/lib/data/hooks/products";
import type { ProductRow } from "@/lib/data/services/products";
import type { Variation } from "@/lib/data/schemas";

export const variationLabel = (p: Pick<ProductRow, "name" | "type">, v: Pick<Variation, "name">) => (p.type === "variable" ? `${p.name} (${v.name})` : p.name);

/** Search box that lists matching products as one option per variation. Only stock-managed, non-combo products are offered. */
export function ProductPicker({ onPick, id = "product-picker", autoFocus }: { onPick: (p: ProductRow, v: Variation) => void; id?: string; autoFocus?: boolean }) {
  const t = useTranslations();
  const [term, setTerm] = useState("");
  const { data } = useProducts({ search: term || undefined, pageSize: 12, active: "active" });
  const options = (term ? (data?.rows ?? []) : [])
    .filter((p) => p.manageStock && p.type !== "combo")
    .flatMap((p) => p.variations.map((v) => ({ p, v })))
    .slice(0, 10);
  return (
    <div className="grid gap-1">
      <Input id={id} aria-label={t("catalog.addProducts")} autoFocus={autoFocus} placeholder={t("ops.searchProducts")} value={term} onChange={(e) => setTerm(e.target.value)} />
      {options.length > 0 && (
        <ul className="rounded-lg border bg-popover p-1 shadow-sm">
          {options.map(({ p, v }) => (
            <li key={v.id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { onPick(p, v); setTerm(""); }}>
                <span>{variationLabel(p, v)}</span>
                <span className="text-xs text-muted-foreground tabular">{v.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
