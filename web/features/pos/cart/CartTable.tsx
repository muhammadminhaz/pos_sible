"use client";

import { useState } from "react";
import { ScanBarcodeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/lib/pos/store";
import { usePosTotals } from "../usePos";
import { CartRow } from "./CartRow";

export function CartTable({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.cart");
  const { cart } = useCart(locationId);
  const totals = usePosTotals(locationId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!cart.lines.length) {
    return <EmptyState icon={ScanBarcodeIcon} title={t("empty")} description={t("emptyHint")} className="flex-1" />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-2 pl-3 text-left font-medium max-sm:hidden">#</th>
            <th scope="col" className="py-2 text-left font-medium max-sm:pl-3">{t("product")}</th>
            <th scope="col" className="py-2 text-left font-medium">{t("qty")}</th>
            <th scope="col" className="py-2 pl-3 text-right font-medium max-sm:hidden">{t("price")}</th>
            <th scope="col" className="py-2 pl-3 pr-2 text-right font-medium">{t("subtotal")}</th>
            <th scope="col"><span className="sr-only">{t("remove", { name: "" })}</span></th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((l, i) => (
            <CartRow
              key={l.key}
              locationId={locationId}
              line={l}
              index={i}
              totals={totals?.lines[i] ?? { unitExc: 0, unitInc: 0, unitTax: 0, discountPerUnit: 0, netUnitInc: 0, subtotal: 0, tax: 0 }}
              expanded={expanded === l.key}
              onToggle={() => setExpanded((k) => (k === l.key ? null : l.key))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
