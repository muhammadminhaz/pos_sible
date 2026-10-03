"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { routeTitleKey } from "@/lib/pageTitle";
import { SITE, withSiteName } from "@/lib/site";

/**
 * Keeps the browser tab and history titled after the screen you are on ("Products · POS-sible"), in the current
 * language. The shop's pages are private and client-rendered, so the title is set here instead of in per-page metadata.
 */
export function PageTitle() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const key = routeTitleKey(pathname);
  const label = key && t.has(key) ? t(key) : null;
  useEffect(() => {
    document.title = label ? withSiteName(label) : SITE.name;
  }, [label]);
  return null;
}
