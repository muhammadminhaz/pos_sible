"use client";

import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon={FileQuestionIcon}
        title={t("errors.notFound")}
        description={t("errors.notFoundBody")}
        action={
          <Button variant="outline" asChild>
            <Link href="/home">{t("common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
