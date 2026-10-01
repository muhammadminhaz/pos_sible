"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSale, useSaleCart } from "@/lib/data/hooks/sales";
import { useSettings } from "@/lib/data/hooks/settings";
import { emptyCart } from "@/lib/pos/cart";
import { SaleForm } from "./SaleForm";

const STATUSES = ["final", "draft", "quotation", "proforma"] as const;

/** Waits for settings (and the sale, when editing) so the form can start from complete state. */
export function SaleFormPage({ id }: { id?: string }) {
  const { data: settings } = useSettings();
  const params = useSearchParams();
  const sale = useSale(id);
  const cart = useSaleCart(id);
  if (!settings || (id && (!sale.data || !cart.data))) return <Skeleton className="h-96" />;
  const wanted = params.get("status");
  const status = id ? (sale.data!.status as (typeof STATUSES)[number]) : STATUSES.find((s) => s === wanted) ?? "final";
  return <SaleForm init={{ id, sale: sale.data, cart: id ? { ...cart.data!, resumedFromId: null } : emptyCart(), status }} />;
}
