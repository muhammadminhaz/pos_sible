import type { useTranslations } from "next-intl";
import { BelowMinPriceError, EditWindowExpiredError, AppError, InsufficientStockError, ProductUnavailableError, SerialsRequiredError, ValidationError } from "@/lib/data/errors";

type T = ReturnType<typeof useTranslations>;

const BY_CODE: Record<string, string> = {
  walk_in_credit: "pos.errors.walkInCredit",
  credit_limit: "errors.creditLimit",
  empty_cart: "sales.noLines",
  forbidden: "errors.forbidden",
  not_found: "pos.errors.saleGone",
};

/** One toast-ready message for any error a sales service can throw. */
export function saleErrorMessage(e: unknown, t: T): string {
  if (e instanceof InsufficientStockError) return t("errors.insufficientStock", { available: e.available, product: e.productName });
  if (e instanceof SerialsRequiredError) return t("pos.errors.serialsRequired", { count: e.count, product: e.productName });
  if (e instanceof EditWindowExpiredError) return t("errors.editWindowExpired");
  if (e instanceof BelowMinPriceError) return t("pos.errors.belowMinPrice", { product: e.productName });
  if (e instanceof ProductUnavailableError) return t("pos.errors.productGone", { product: e.productName });
  if (e instanceof ValidationError) {
    if (e.fields.serviceStaff) return t("pos.errors.serviceStaffRequired");
    for (const [field, code] of Object.entries(e.fields)) {
      for (const key of [`sales.errors.${code}`, `sales.errors.${code}_${field}`, `sales.errors.${field}_${code}`]) {
        if (t.has(key)) return t(key);
      }
    }
  }
  if (e instanceof AppError) {
    if (t.has(`sales.errors.${e.code}`)) return t(`sales.errors.${e.code}`);
    if (BY_CODE[e.code]) return t(BY_CODE[e.code]);
  }
  return t("errors.generic");
}
