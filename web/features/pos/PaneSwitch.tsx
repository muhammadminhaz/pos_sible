"use client";

import { ShoppingCartIcon, LayoutGridIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { useFormat } from "@/lib/i18n/format";
import { useCart } from "@/lib/pos/store";

/** Tablet layout: switch between the product grid and the cart. Hidden on wide screens, where both show. */
export function PaneSwitch({ pane, onChange, locationId }: { pane: "products" | "cart"; onChange: (p: "products" | "cart") => void; locationId: string }) {
  const t = useTranslations("pos");
  const f = useFormat();
  const { cart } = useCart(locationId);
  const count = cart.lines.length;
  const tab = (id: "products" | "cart", label: string, Icon: typeof LayoutGridIcon, badge?: number) => (
    <button
      type="button" role="tab" aria-selected={pane === id} onClick={() => onChange(id)}
      className={cn("flex h-10 flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors", pane === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}
    >
      <Icon className="size-4" />
      {label}
      {!!badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums">{f.number(badge)}</span>}
    </button>
  );
  return (
    <div role="tablist" aria-label={t("panes")} className="flex border-b bg-card lg:hidden">
      {tab("products", t("paneProducts"), LayoutGridIcon)}
      {tab("cart", t("paneCart"), ShoppingCartIcon, count)}
    </div>
  );
}
