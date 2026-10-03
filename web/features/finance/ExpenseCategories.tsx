"use client";

import { crudPerm } from "@/lib/auth/permissions";
import { TagsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CrudPage, type CrudConfig } from "@/features/catalog/CrudPage";
import { useLookups } from "@/lib/data/hooks/lookups";

export function ExpenseCategoriesPage() {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const cats = lookups?.expenseCategories ?? [];
  const parentName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "";
  const cfg: CrudConfig<"expenseCategories"> = {
    table: "expenseCategories", title: t("nav.expenseCategories"), description: t("finance.categoriesDescription"), icon: TagsIcon, permission: crudPerm("expense"),
    addLabel: t("finance.addCategory"), editLabel: t("finance.editCategory"), emptyTitle: t("finance.noCategories"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "code", label: t("finance.categoryCode") },
      { key: "parentId", label: t("finance.parentCategory"), render: (c) => parentName(c.parentId) || "—", csv: (c) => parentName(c.parentId) },
    ],
    fields: [
      { key: "name", type: "text", label: t("catalog.name"), required: true, half: true },
      { key: "code", type: "text", label: t("finance.categoryCode"), half: true },
      {
        key: "parentId", type: "select", label: t("finance.parentCategory"), nullable: true,
        // One level of sub-category: only top-level categories can be a parent.
        options: ({ id }) => cats.filter((c) => !c.parentId && c.id !== id).map((c) => ({ value: c.id, label: c.name })),
      },
    ],
  };
  return <CrudPage cfg={cfg} />;
}
