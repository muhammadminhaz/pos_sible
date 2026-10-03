"use client";

import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon={TriangleAlertIcon}
        title={t("errors.generic")}
        description={t("errors.genericBody")}
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>{t("common.tryAgain")}</Button>
            <Button variant="outline" asChild>
              <Link href="/home">{t("common.goHome")}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
