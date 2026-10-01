"use client";

import { BadgeCheckIcon, LayersIcon, RulerIcon, ShieldCheckIcon, TagIcon, TagsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { useLookups } from "@/lib/data/hooks/lookups";
import { CrudPage, type CrudConfig, type FieldDef } from "./CrudPage";

type T = ReturnType<typeof useTranslations>;

const text = (t: T, key: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, type: "text", label: t(`catalog.${key}`), ...extra });

export function BrandsPage() {
  const t = useTranslations();
  const cfg: CrudConfig<"brands"> = {
    table: "brands", title: t("nav.brands"), description: t("catalog.brandsDescription"), icon: TagIcon,
    addLabel: t("catalog.addBrand"), editLabel: t("catalog.editBrand"), emptyTitle: t("catalog.noBrands"),
    columns: [{ key: "name", label: t("catalog.name") }, { key: "note", label: t("catalog.note") }],
    fields: [text(t, "name", { required: true }), { key: "note", type: "textarea", label: t("catalog.note") }],
  };
  return <CrudPage cfg={cfg} />;
}

export function WarrantiesPage() {
  const t = useTranslations();
  const cfg: CrudConfig<"warranties"> = {
    table: "warranties", title: t("nav.warranties"), description: t("catalog.warrantiesDescription"), icon: ShieldCheckIcon,
    addLabel: t("catalog.addWarranty"), editLabel: t("catalog.editWarranty"), emptyTitle: t("catalog.noWarranties"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "duration", label: t("catalog.duration"), render: (w) => `${w.duration} ${t(`catalog.${w.durationType}`)}`, csv: (w) => `${w.duration} ${w.durationType}` },
      { key: "description", label: t("catalog.description") },
    ],
    fields: [
      text(t, "name", { required: true }),
      { key: "duration", type: "number", label: t("catalog.duration"), required: true, min: 1, initial: 1, half: true },
      {
        key: "durationType", type: "select", label: t("catalog.durationType"), initial: "months", half: true,
        options: () => (["days", "months", "years"] as const).map((v) => ({ value: v, label: t(`catalog.${v}`) })),
      },
      { key: "description", type: "textarea", label: t("catalog.description") },
    ],
  };
  return <CrudPage cfg={cfg} />;
}

export function PriceGroupsPage() {
  const t = useTranslations();
  const cfg: CrudConfig<"priceGroups"> = {
    table: "priceGroups", title: t("nav.priceGroups"), description: t("catalog.priceGroupsDescription"), icon: BadgeCheckIcon,
    addLabel: t("catalog.addPriceGroup"), editLabel: t("catalog.editPriceGroup"), emptyTitle: t("catalog.noPriceGroups"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "description", label: t("catalog.description") },
      {
        key: "active", label: t("common.status"), csv: (g) => (g.active ? t("common.active") : t("common.inactive")),
        render: (g) => <Badge variant={g.active ? "secondary" : "outline"}>{g.active ? t("common.active") : t("common.inactive")}</Badge>,
      },
    ],
    fields: [
      text(t, "name", { required: true }),
      { key: "description", type: "textarea", label: t("catalog.description") },
      { key: "active", type: "switch", label: t("common.active"), initial: true },
    ],
  };
  return <CrudPage cfg={cfg} />;
}

export function UnitsPage() {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const units = lookups?.units ?? [];
  const cfg: CrudConfig<"units"> = {
    table: "units", title: t("nav.units"), description: t("catalog.unitsDescription"), icon: RulerIcon,
    addLabel: t("catalog.addUnit"), editLabel: t("catalog.editUnit"), emptyTitle: t("catalog.noUnits"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "shortName", label: t("catalog.shortName") },
      { key: "allowDecimal", label: t("catalog.allowDecimal"), render: (u) => (u.allowDecimal ? t("common.yes") : t("common.no")) },
      {
        key: "multiplier", label: t("catalog.conversion"),
        render: (u) => {
          const base = units.find((x) => x.id === u.baseUnitId);
          return base && u.multiplier ? `1 ${u.shortName} = ${u.multiplier} ${base.shortName}` : "—";
        },
      },
    ],
    fields: [
      text(t, "name", { required: true, half: true }),
      text(t, "shortName", { required: true, half: true }),
      { key: "allowDecimal", type: "switch", label: t("catalog.allowDecimal") },
      {
        key: "baseUnitId", type: "select", label: t("catalog.baseUnit"), nullable: true, half: true,
        // A base unit can't itself be a sub-unit, and a unit can't be its own base.
        options: ({ id }) => units.filter((u) => !u.baseUnitId && u.id !== id).map((u) => ({ value: u.id, label: `${u.name} (${u.shortName})` })),
      },
      { key: "multiplier", type: "number", label: t("catalog.multiplier"), min: 0, half: true, show: (v) => !!v.baseUnitId },
    ],
  };
  return <CrudPage cfg={cfg} />;
}

export function CategoriesPage() {
  const t = useTranslations();
  const { data: lookups } = useLookups();
  const cats = lookups?.categories ?? [];
  const cfg: CrudConfig<"categories"> = {
    table: "categories", title: t("nav.categories"), description: t("catalog.categoriesDescription"), icon: LayersIcon,
    addLabel: t("catalog.addCategory"), editLabel: t("catalog.editCategory"), emptyTitle: t("catalog.noCategories"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "code", label: t("catalog.code") },
      { key: "parentId", label: t("catalog.parent"), render: (c) => cats.find((x) => x.id === c.parentId)?.name ?? "—", csv: (c) => cats.find((x) => x.id === c.parentId)?.name ?? "" },
      { key: "description", label: t("catalog.description") },
    ],
    fields: [
      text(t, "name", { required: true, half: true }),
      text(t, "code", { half: true }),
      {
        key: "parentId", type: "select", label: t("catalog.parent"), nullable: true,
        // One level of sub-category: only top-level categories can be a parent.
        options: ({ id }) => cats.filter((c) => !c.parentId && c.id !== id).map((c) => ({ value: c.id, label: c.name })),
      },
      { key: "description", type: "textarea", label: t("catalog.description") },
    ],
  };
  return <CrudPage cfg={cfg} />;
}

export function VariationsPage() {
  const t = useTranslations();
  const cfg: CrudConfig<"variationTemplates"> = {
    table: "variationTemplates", title: t("nav.variations"), description: t("catalog.variationsDescription"), icon: TagsIcon,
    addLabel: t("catalog.addVariation"), editLabel: t("catalog.editVariation"), emptyTitle: t("catalog.noVariations"),
    columns: [
      { key: "name", label: t("catalog.name") },
      { key: "values", label: t("catalog.values"), render: (v) => v.values.join(", ") || "—", csv: (v) => v.values.join("|") },
    ],
    fields: [text(t, "name", { required: true }), { key: "values", type: "list", label: t("catalog.values") }],
  };
  return <CrudPage cfg={cfg} />;
}
