"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionForm } from "./SectionForm";

/** Switches a module off and its menu items and routes disappear together. */
export function ModulesPage() {
  const t = useTranslations();
  return (
    <>
      <PageHeader title={t("nav.modules")} description={t("settings.modulesDescription")} />
      <div className="rounded-xl border bg-card p-5"><SectionForm section="modules" /></div>
    </>
  );
}
