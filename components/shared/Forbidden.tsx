"use client";

import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

export function Forbidden() {
  const t = useTranslations();
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon={ShieldAlertIcon}
        title={t("auth.forbiddenTitle")}
        description={t("auth.forbiddenBody")}
        action={
          <Button variant="outline" asChild>
            <Link href="/home">{t("common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
