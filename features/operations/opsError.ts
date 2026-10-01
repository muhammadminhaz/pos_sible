import type { useTranslations } from "next-intl";
import { AppError, ForbiddenError, InsufficientStockError, ValidationError } from "@/lib/data/errors";

type T = ReturnType<typeof useTranslations>;

/** One toast-ready message for any error the contacts, purchases and stock services can throw. */
export function opsErrorMessage(e: unknown, t: T): string {
  if (e instanceof ForbiddenError) return t("errors.forbidden");
  if (e instanceof InsufficientStockError) return t("errors.insufficientStock", { available: e.available, product: e.productName });
  if (e instanceof ValidationError) {
    for (const [field, code] of Object.entries(e.fields)) {
      for (const key of [`ops.errors.${field}_${code}`, `ops.errors.${code}`]) if (t.has(key)) return t(key);
    }
  }
  if (e instanceof AppError && t.has(`ops.errors.${e.code}`)) return t(`ops.errors.${e.code}`);
  return t("errors.generic");
}
