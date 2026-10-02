import type { useTranslations } from "next-intl";
import { EditWindowExpiredError, AppError, ForbiddenError, ValidationError } from "@/lib/data/errors";

type T = ReturnType<typeof useTranslations>;

/** One toast-ready message for any error a catalog service can throw. */
export function catalogErrorMessage(e: unknown, t: T): string {
  if (e instanceof ForbiddenError) return t("errors.forbidden");
  if (e instanceof EditWindowExpiredError) return t("errors.editWindowExpired");
  if (e instanceof ValidationError) {
    for (const [field, code] of Object.entries(e.fields)) {
      for (const key of [`catalog.errors.${field}_${code}`, `catalog.errors.${code}`]) if (t.has(key)) return t(key);
    }
  }
  if (e instanceof AppError && t.has(`catalog.errors.${e.code}`)) return t(`catalog.errors.${e.code}`);
  return t("errors.generic");
}
