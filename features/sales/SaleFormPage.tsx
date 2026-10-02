"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderToSale, useSale, useSaleCart } from "@/lib/data/hooks/sales";
import { useSettings } from "@/lib/data/hooks/settings";
import { useLookups } from "@/lib/data/hooks/lookups";
import { applySaleDefaults, emptyCart } from "@/lib/pos/cart";
import { SaleForm } from "./SaleForm";

const STATUSES = ["final", "draft", "quotation", "proforma"] as const;

/** Waits for settings (and the sale, when editing) so the form can start from complete state. */
export function SaleFormPage({ id }: { id?: string }) {
  const { data: settings } = useSettings();
  const { data: lookups } = useLookups();
  const params = useSearchParams();
  const sale = useSale(id);
  const cart = useSaleCart(id);
  const orderId = !id ? params.get("order") ?? undefined : undefined;
  const fromOrder = useOrderToSale(orderId);
  if (!settings || !lookups || (id && (!sale.data || !cart.data)) || (orderId && fromOrder.isPending)) return <Skeleton className="h-96" />;
  const wanted = params.get("status");
  const status = id ? (sale.data!.status as (typeof STATUSES)[number]) : STATUSES.find((s) => s === wanted) ?? "final";
  const order = fromOrder.data;
  return <SaleForm init={{ id, sale: sale.data, locationId: order?.locationId, orderIds: order ? [orderId!] : undefined, cart: order ? order.cart : id ? { ...cart.data!, resumedFromId: null } : applySaleDefaults(emptyCart(), settings.sale, settings.sale.defaultTaxId ? lookups.taxRates.find((x) => x.id === settings.sale.defaultTaxId)?.rate ?? null : null), status }} />;
}
