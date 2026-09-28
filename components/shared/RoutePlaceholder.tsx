"use client";

import { useTranslations } from "next-intl";
import { ROUTES, type RoutePattern } from "@/lib/routes";
import { RequirePermission } from "./Can";
import { ComingSoon } from "./ComingSoon";

/** Permission-gated ComingSoon for a scaffolded route; each sub-project replaces these pages. */
export function RoutePlaceholder({ route }: { route: RoutePattern }) {
  const t = useTranslations();
  const meta = ROUTES[route];
  return (
    <RequirePermission permission={"permission" in meta ? meta.permission : undefined}>
      <ComingSoon title={t(`nav.${meta.title}`)} module={t(`modules.${meta.module}`)} />
    </RequirePermission>
  );
}
