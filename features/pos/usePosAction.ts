"use client";

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
      };
      if (byCode[e.code]) return toast.error(t(byCode[e.code]));
    }
    toast.error(t("errors.generic"));
  };
}

/**
 * Checkout + the follow-up every entry point shares: clear the cart, toast, then the receipt modal
 * for final sales (and suspended ones when `printOnSuspend`). Other statuses get a Print toast action.
 */
export function useCheckout(locationId: string) {
  const t = useTranslations();
  const { cart, reset } = useCart(locationId);
  const { checkout } = usePosMutations();
  const { data: settings } = useSettings();
  const onError = usePosError();
  const { hide, showReceipt } = usePosDialogs();

  const run = async (status: SaleStatus, payments: CheckoutPayment[] = [], staffNote?: string) => {
    try {
      const res = await checkout.mutateAsync({ cart, locationId, status, payments, staffNote });
      reset();
      useCartFlag.getState().flag(null);
      const msg = t(`pos.done.${status}`, { ref: res.refNo });
      if (status === "final" || (status === "suspended" && settings?.pos.printOnSuspend)) {
        toast.success(msg);
        showReceipt(res.id);
      } else {
        toast.success(msg, { action: { label: t("common.print"), onClick: () => showReceipt(res.id) } });
        hide();
      }
      focusSearch();
      return true;
    } catch (e) {
      onError(e);
      return false;
    }
  };
  return { run, pending: checkout.isPending };
}
