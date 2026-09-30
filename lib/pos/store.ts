"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "@/lib/data/store/storage";
import { emptyCart, type Cart } from "./cart";

type CartState = {
  carts: Record<string, Cart>;
  update: (locationId: string, fn: (c: Cart) => Cart) => void;
  replace: (locationId: string, cart: Cart) => void;
  reset: (locationId: string) => void;
};

/** One in-progress cart per location, kept across reloads so a refresh never loses a sale. */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      update: (loc, fn) => set((s) => ({ carts: { ...s.carts, [loc]: fn(s.carts[loc] ?? emptyCart()) } })),
      replace: (loc, cart) => set((s) => ({ carts: { ...s.carts, [loc]: cart } })),
      reset: (loc) => set((s) => ({ carts: { ...s.carts, [loc]: emptyCart() } })),
    }),
    { name: "posible:v1:pos-cart", storage: safeStorage() },
  ),
);

const EMPTY = emptyCart();

export function useCart(locationId: string) {
  const cart = useCartStore((s) => s.carts[locationId]) ?? EMPTY;
  const update = useCartStore((s) => s.update);
  const replace = useCartStore((s) => s.replace);
  const reset = useCartStore((s) => s.reset);
  return {
    cart,
    update: (fn: (c: Cart) => Cart) => update(locationId, fn),
    replace: (c: Cart) => replace(locationId, c),
    reset: () => reset(locationId),
  };
}
