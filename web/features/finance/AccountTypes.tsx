"use client";

import { LandmarkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CrudPage, type CrudConfig } from "@/features/catalog/CrudPage";
import { useLookups } from "@/lib/data/hooks/lookups";

export function AccountTypes() {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const types = lookups?.accountTypes ?? [];
  const parentName = (id: string | null) => types.find((x) => x.id === id)?.name ?? "";
  const cfg: CrudConfig<"accountTypes"> = {
    table: "accountTypes", title: t("finance.tabTypes"), description: t("finance.typesDescription"), icon: LandmarkIcon, permission: { create: "account.create", update: "account.update", delete: "account.update" }, embedded: true,
    addLabel: t("finance.addAccountType"), editLabel: t("finance.editAccountType"), emptyTitle: t("finance.noAccountTypes"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "parentId", label: t("finance.parentType"), render: (x) => parentName(x.parentId) || "—", csv: (x) => parentName(x.parentId) },
    ],
    fields: [
      { key: "name", type: "text", label: t("catalog.name"), required: true },
      {
        key: "parentId", type: "select", label: t("finance.parentType"), nullable: true,
        // One level of sub-type: only top-level types can be a parent.
        options: ({ id }) => types.filter((x) => !x.parentId && x.id !== id).map((x) => ({ value: x.id, label: x.name })),
      },
    ],
  };
  return <CrudPage cfg={cfg} />;
}
