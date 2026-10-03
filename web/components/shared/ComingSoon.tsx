"use client";

import Link from "next/link";
import { ConstructionIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

/** Placeholder for screens owned by a later sub-project. */
export function ComingSoon({ title, module }: { title: string; module: string }) {
  const t = useTranslations("common");
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-xl border border-dashed bg-card">
        <EmptyState
          icon={ConstructionIcon}
          title={t("comingSoon")}
          description={t("comingIn", { module })}
          action={
            <Button variant="outline" asChild>
              <Link href="/home">{t("goHome")}</Link>
            </Button>
          }
        />
      </div>
    </>
  );
}
