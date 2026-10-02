"use client";

import Link from "next/link";
import { MonitorIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

/** Below 768px (a phone) the register doesn't fit; say so instead of rendering a broken screen. Tablets get a two-tab layout. */
export function Narrow() {
  const t = useTranslations();
  return (
    <div className="grid min-h-dvh place-items-center p-6 md:hidden">
      <EmptyState
        icon={MonitorIcon}
        title={t("pos.narrow")}
        action={
          <Button variant="outline" asChild>
            <Link href="/home">{t("common.back")}</Link>
          </Button>
        }
      />
    </div>
  );
}
