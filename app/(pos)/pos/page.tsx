"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { RequirePermission } from "@/components/shared/Can";
import { ComingSoon } from "@/components/shared/ComingSoon";

export default function PosPage() {
  const t = useTranslations();
  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/home">
            <ArrowLeftIcon />
            {t("common.back")}
          </Link>
        </Button>
        <LogoMark />
        <span className="font-semibold">{t("nav.pos")}</span>
        <div className="ml-auto flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <RequirePermission permission="pos.access">
          <ComingSoon title={t("nav.pos")} module={t("modules.pos")} />
        </RequirePermission>
      </main>
    </>
  );
}
