"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PowerOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/authStore";
import { useSettings } from "@/lib/data/hooks/settings";
import { isPathEnabled } from "@/lib/modules";
import { EmptyState } from "./EmptyState";

/** Shows a "module is off" state instead of a route whose module switch is off in Settings. */
export function ModuleGate({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const settings = useSettings().data;
  const licensed = useAuth((s) => s.modules);
  if (isPathEnabled(settings, pathname, licensed)) return children;
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon={PowerOffIcon}
        title={t("settings.moduleOffTitle")}
        description={t("settings.moduleOffBody")}
        action={<Button variant="outline" asChild><Link href="/home">{t("common.goHome")}</Link></Button>}
      />
    </div>
  );
}
