"use client";

import { useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AppError, InsufficientStockError, ProductUnavailableError, SerialsRequiredError, ValidationError } from "@/lib/data/errors";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import type { CheckoutPayment, SaleStatus } from "@/lib/data/services/sales";
import { useCart } from "@/lib/pos/store";
import { useCartFlag, usePosDialogs } from "./dialogStore";
import { focusSearch } from "./focus";

export function usePosError() {
  const t = useTranslations();
  const flag = useCartFlag((s) => s.flag);
  return (e: unknown) => {
    if (e instanceof InsufficientStockError || e instanceof SerialsRequiredError || e instanceof ProductUnavailableError) flag(e.productName);
    if (e instanceof InsufficientStockError) return toast.error(t("errors.insufficientStock", { available: e.available, product: e.productName }));
    if (e instanceof SerialsRequiredError) return toast.error(t("pos.errors.serialsRequired", { count: e.count, product: e.productName }));
    if (e instanceof ProductUnavailableError) return toast.error(t("pos.errors.productGone", { product: e.productName }));
    if (e instanceof ValidationError) {
      if (e.fields.payments) return toast.error(t("pos.pay.nonCashOverpaid"));
      if (e.fields.pointsRedeemed) return toast.error(t("pos.errors.pointsInvalid"));
    }
    if (e instanceof AppError) {
      const byCode: Record<string, string> = {
        walk_in_credit: "pos.errors.walkInCredit",
        credit_limit: "errors.creditLimit",
        empty_cart: "pos.errors.emptyCart",
        not_deletable: "pos.errors.notDeletable",
        register_open: "pos.errors.registerOpen",
        register_closed: "pos.errors.registerClosed",
        not_found: "pos.errors.saleGone",
        forbidden: "errors.forbidden",
      };
      if (byCode[e.code]) return toast.error(t(byCode[e.code]));
    }
    toast.error(t("errors.generic"));
  };
}

/**
 * Checkout + the follow-up every entry point shares: clear the cart, toast, then the receipt modal
 * for final sales (and suspended ones when `printOnSuspend`). Other statuses get a Print toast action.
 *
 * `pending` is read from the shared mutation cache (`mutationKey: ["checkout"]`, set in
 * `lib/data/hooks/pos.ts`) rather than this call's own `checkout.isPending`, so every entry
 * point — ActionBar's hotkeys, the payment dialog — agrees on whether a checkout is in flight
 * even though each calls `useCheckout` (and so `usePosMutations`) separately. `inFlight` is a
 * synchronous backstop: TanStack Query flushes observer updates on a timer, so `pending` can
 * still read false for the first instant after `mutateAsync` starts.
 */
export function useCheckout(locationId: string) {
  const t = useTranslations();
  const { cart, reset } = useCart(locationId);
  const { checkout } = usePosMutations();
  const { data: settings } = useSettings();
  const onError = usePosError();
  const hide = usePosDialogs((s) => s.hide);
  const showReceipt = usePosDialogs((s) => s.showReceipt);
  const pending = useIsMutating({ mutationKey: ["checkout"] }) > 0;
  const inFlight = useRef(false);

  const run = async (status: SaleStatus, payments: CheckoutPayment[] = [], staffNote?: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    try {
      const res = await checkout.mutateAsync({ cart, locationId, status, payments, staffNote });
      reset();
      useCartFlag.getState().flag(null);
      const msg = t(`pos.done.${status}`, { ref: res.refNo });
      if (status === "final" || (status === "suspended" && settings?.pos.printOnSuspend)) {
        toast.success(msg);
        showReceipt(res.id); // the receipt's own close returns focus to search; "New sale" holds it until then
      } else {
        toast.success(msg, { action: { label: t("common.print"), onClick: () => showReceipt(res.id) } });
        hide();
        focusSearch();
      }
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      inFlight.current = false;
    }
  };
  return { run, pending };
}
