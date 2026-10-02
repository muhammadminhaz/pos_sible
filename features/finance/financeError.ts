import type { useTranslations } from "next-intl";
import { AppError, ForbiddenError, ValidationError } from "@/lib/data/errors";

type T = ReturnType<typeof useTranslations>;

/** One toast-ready message for any error the expenses and accounts services can throw. */
export function financeErrorMessage(e: unknown, t: T): string {
  if (e instanceof ForbiddenError) return t("errors.forbidden");
  if (e instanceof ValidationError) {
    for (const [field, code] of Object.entries(e.fields)) {
      for (const key of [`finance.errors.${field}_${code}`, `finance.errors.${code}`]) if (t.has(key)) return t(key);
    }
  }
  if (e instanceof AppError && t.has(`finance.errors.${e.code}`)) return t(`finance.errors.${e.code}`);
  return t("errors.generic");
}
