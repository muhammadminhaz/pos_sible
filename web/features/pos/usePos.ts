"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { create } from "zustand";
import { useCurrentUser } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { toCartItem, type PosProduct, type PosVariation } from "@/lib/data/services/pos";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { addItem, applySaleDefaults, exceedsStock } from "@/lib/pos/cart";
import { cartTotals } from "@/lib/pos/selectors";
import { useCart } from "@/lib/pos/store";

/** The till's location: the global switcher's pick when usable here, else the user's first location. */
export function usePosLocation() {
  const { data } = useLookups();
  const user = useCurrentUser()?.user;
  const selected = useUI((s) => s.locationId);
  const allowed = (data?.locations ?? []).filter(
    (l) => l.active && (!user?.locationIds.length || user.locationIds.includes(l.id)),
  );
  return { location: allowed.find((l) => l.id === selected) ?? allowed[0], allowed };
}

export function usePosTotals(locationId: string) {
  const { cart } = useCart(locationId);
  const { data: settings } = useSettings();
  return settings ? cartTotals(cart, { rounding: settings.sale.roundingMethod, rewards: settings.rewards }) : null;
}

/**
 * The line that was just added or bumped; CartRow flashes it and scrolls it into view.
 * `n` is a monotonic token: it increments on every flash, even repeats of the same key, so a
 * CartRow can key its flash overlay on `n` and replay the animation without remounting the row.
 */
export const useFlash = create<{ key: string | null; n: number; flash: (key: string) => void }>()((set) => ({
  key: null,
  n: 0,
  flash: (key) => set((s) => ({ key, n: s.n + 1 })),
}));

/** Adds a product to the cart, refusing (with a toast) when it would oversell managed stock. */
export function useAddToCart(locationId: string) {
  const t = useTranslations();
  const f = useFormat();
  const { cart, update } = useCart(locationId);
  const { data: settings } = useSettings();
  const flash = useFlash((s) => s.flash);
  const qc = useQueryClient();
  const { data: lookups } = useLookups();
  const taxRateOf = (id: string | null) => (id ? lookups?.taxRates.find((x) => x.id === id)?.rate ?? null : null);

  return (p: PosProduct, v: PosVariation, qty = 1) => {
    // Read live, not from render: ProductSearch adds after an await, by which time a checkout may have started.
    if (qc.isMutating({ mutationKey: ["checkout"] }) > 0) return false; // a new line would be wiped by the post-checkout reset
    const item = toCartItem(p, v, qty);
    // The first item of a new sale brings in the business's default discount and order tax.
    const base = settings && cart.lines.length === 0 ? applySaleDefaults(cart, settings.sale, taxRateOf(settings.sale.defaultTaxId)) : cart;
    const next = addItem(base, item, settings?.sale.itemAdditionMethod ?? "increase_qty");
    // addItem returns a new object for the touched line, so the changed line is the one not in the old cart.
    const line = next.lines.find((l) => !base.lines.includes(l))!;
    if (!settings?.sale.allowOverselling && exceedsStock(line)) {
      toast.error(t("errors.insufficientStock", { available: f.qty(v.stock), product: item.name }));
      return false;
    }
    update(() => next);
    flash(line.key);
    return true;
  };
}
