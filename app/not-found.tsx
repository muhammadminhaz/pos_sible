"use client";

import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { LogoMark } from "@/components/layout/LogoMark";

/** Unmatched URLs anywhere in the app (the (app) group's not-found only covers `notFound()` calls). */
export default function RootNotFound() {
  const t = useTranslations();
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card">
        <div className="flex justify-center pt-8">
          <LogoMark />
        </div>
        <EmptyState
          icon={FileQuestionIcon}
          title={t("errors.notFound")}
          description={t("errors.notFoundBody")}
          action={
            <Button asChild>
              <Link href="/home">{t("common.goHome")}</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
