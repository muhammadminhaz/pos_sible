"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { storageHealth } from "@/lib/data/store/storage";

/** Shown only if the browser refuses to save the database, so nobody keeps working on data that will be lost. */
export function StorageBanner() {
  const t = useTranslations("header");
  const h = useSyncExternalStore(storageHealth.subscribe, storageHealth.get, storageHealth.get);
  if (h.ok) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger-foreground">
      <AlertTriangleIcon className="size-4 shrink-0" />
      <span className="font-medium">{t("storageFailed")}</span>
      <span>{t("storageFailedHint")}</span>
      <Link href="/settings/backup" className="underline underline-offset-2">{t("storageBackupLink")}</Link>
    </div>
  );
}
