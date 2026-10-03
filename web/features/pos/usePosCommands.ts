"use client";

import type { Location } from "@/lib/data/schemas";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs, type PaymentMode } from "./dialogStore";
import { useCheckout } from "./usePosAction";
import { usePosTotals } from "./usePos";

/** Every sale-level action, guarded against an empty cart and a checkout in flight. */
export function usePosCommands(location: Location) {
  const { cart } = useCart(location.id);
  const totals = usePosTotals(location.id);
  const { run, pending } = useCheckout(location.id);
  const { show, showPayment } = usePosDialogs();
  const empty = cart.lines.length === 0;
  const payable = totals?.total ?? 0;
  const guard = (fn: () => void) => () => {
    if (!empty && !pending) fn();
  };

  return {
    empty,
    pending,
    payable,
    express: guard(() => void run("final", [{ method: "cash", amount: payable }])),
    credit: guard(() => void run("final", [])),
    draft: guard(() => void run("draft")),
    quotation: guard(() => void run("quotation")),
    pay: (mode: PaymentMode) => guard(() => showPayment(mode))(),
    suspend: guard(() => show("suspend")),
    cancel: guard(() => show("cancel")),
  };
}
