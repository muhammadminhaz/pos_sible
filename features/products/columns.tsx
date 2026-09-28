"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BarcodeIcon,
  CopyIcon,
  EyeIcon,
  HistoryIcon,
  PackagePlusIcon,
  PencilIcon,
  PowerIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import type { useTranslations } from "next-intl";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/shared/DataTable/RowActions";
import { Money } from "@/components/shared/Money";
import type { ProductRow } from "@/lib/data/services/products";
import type { Formatter } from "@/lib/i18n/format";

type T = ReturnType<typeof useTranslations>;

export type ProductActions = {
  can: (p?: string) => boolean;
  onToggleActive: (p: ProductRow) => void;
  onDelete: (p: ProductRow) => void;
};

const lowStock = (p: ProductRow) => p.manageStock && p.alertQty != null && p.stock <= p.alertQty;

function Thumb({ p }: { p: ProductRow }) {
  if (p.image) {
    // eslint-disable-next-line @next/next/no-img-element -- mock data URLs, not optimisable
    return <img src={p.image} alt="" className="size-8 rounded-md border object-cover" />;
  }
  const initials = p.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className="grid size-8 place-items-center rounded-md border bg-muted text-[11px] font-semibold text-muted-foreground">
      {initials}
    </span>
  );
}

function ProductCell({ p, t }: { p: ProductRow; t: T }) {
  return (
    <div className="flex min-w-48 items-center gap-2.5">
      <Link
        href={`/products/${p.id}`}
        onClick={(e) => e.stopPropagation()}
        className={cn("min-w-0 hover:underline", !p.active && "text-muted-foreground")}
      >
        <div className="truncate font-medium">{p.name}</div>
        <div className="truncate text-xs text-muted-foreground tabular">{p.sku}</div>
      </Link>
      {!p.active && <Badge variant="secondary">{t("common.inactive")}</Badge>}
      {p.notForSale && <Badge variant="outline">{t("products.notForSelling")}</Badge>}
    </div>
  );
}

function StockCell({ p, t, f }: { p: ProductRow; t: T; f: Formatter }) {
  if (!p.manageStock) return <span className="whitespace-nowrap text-muted-foreground">{t("products.noStock")}</span>;
  const low = lowStock(p);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap tabular", low && "text-warning-foreground")}>
      {low && <TriangleAlertIcon className="size-3.5 text-warning" aria-label={t("products.lowStock")} />}
      {f.qty(p.stock)} {p.unitName}
    </span>
  );
}

export function productColumns(t: T, f: Formatter, a: ProductActions): ColumnDef<ProductRow>[] {
  return [
    {
      id: "image",
      header: t("products.image"),
      enableSorting: false,
      meta: { label: t("products.image"), className: "w-12", csv: () => undefined },
      cell: ({ row }) => <Thumb p={row.original} />,
    },
    {
      id: "name",
      accessorKey: "name",
      header: t("products.product"),
      meta: { label: t("products.product") },
      cell: ({ row }) => <ProductCell p={row.original} t={t} />,
    },
    {
      id: "sku",
      accessorKey: "sku",
      header: t("products.sku"),
      meta: { label: t("products.sku") },
      cell: ({ getValue }) => <span className="tabular">{getValue<string>()}</span>,
    },
    {
      id: "locations",
      header: t("products.locations"),
      enableSorting: false,
      meta: { label: t("products.locations"), csv: (p) => p.locationNames.join(", ") },
      cell: ({ row }) => {
        const [first, ...rest] = row.original.locationNames;
        return (
          <div className="flex items-center gap-1" title={row.original.locationNames.join(", ")}>
            {first && (
              <Badge variant="outline" className="max-w-44 truncate font-normal">
                {first}
              </Badge>
            )}
            {rest.length > 0 && (
              <Badge variant="secondary" className="font-normal tabular">
                +{rest.length}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "purchasePrice",
      accessorKey: "purchasePrice",
      header: t("products.purchasePrice"),
      meta: { label: t("products.purchasePrice"), align: "right" },
      cell: ({ row }) => <Money value={row.original.purchasePrice} />,
    },
    {
      id: "sellPrice",
      accessorKey: "sellPrice",
      header: t("products.sellingPrice"),
      meta: { label: t("products.sellingPrice"), align: "right" },
      cell: ({ row }) => <Money value={row.original.sellPrice} />,
    },
    {
      id: "stock",
      accessorKey: "stock",
      header: t("products.currentStock"),
      meta: { label: t("products.currentStock"), align: "right" },
      cell: ({ row }) => <StockCell p={row.original} t={t} f={f} />,
    },
    {
      id: "type",
      accessorKey: "type",
      header: t("products.type"),
      meta: { label: t("products.type"), csv: (p) => t(`products.${p.type}`) },
      cell: ({ row }) => t(`products.${row.original.type}`),
    },
    {
      id: "categoryName",
      accessorKey: "categoryName",
      header: t("products.category"),
      meta: { label: t("products.category"), className: "whitespace-nowrap" },
      cell: ({ getValue }) => getValue<string>() ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "brandName",
      accessorKey: "brandName",
      header: t("products.brand"),
      meta: { label: t("products.brand") },
      cell: ({ getValue }) => getValue<string>() ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "taxName",
      accessorKey: "taxName",
      header: t("products.tax"),
      meta: { label: t("products.tax") },
      cell: ({ getValue }) => getValue<string>() ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <RowActions
            items={[
              { label: t("common.view"), icon: EyeIcon, href: `/products/${p.id}` },
              { label: t("common.edit"), icon: PencilIcon, href: `/products/${p.id}/edit`, hidden: !a.can("product.update") },
              { label: t("products.labels"), icon: BarcodeIcon, href: `/products/labels?product=${p.id}` },
              { label: t("common.duplicate"), icon: CopyIcon, href: `/products/new?duplicate=${p.id}`, hidden: !a.can("product.create") },
              {
                label: t("products.openingStock"),
                icon: PackagePlusIcon,
                href: `/products/import-opening-stock?product=${p.id}`,
                hidden: !a.can("product.opening_stock") || !p.manageStock,
              },
              { label: t("products.stockHistory"), icon: HistoryIcon, href: `/reports/stock?product=${p.id}` },
              {
                label: p.active ? t("common.deactivate") : t("common.activate"),
                icon: PowerIcon,
                onClick: () => a.onToggleActive(p),
                hidden: !a.can("product.update"),
              },
              { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => a.onDelete(p), hidden: !a.can("product.delete") },
            ]}
          />
        );
      },
    },
  ];
}

/** Stock report tab: per-product valuation at the filtered location. */
export function stockColumns(t: T, f: Formatter): ColumnDef<ProductRow>[] {
  const money = (id: string, label: string, value: (p: ProductRow) => number): ColumnDef<ProductRow> => ({
    id,
    accessorFn: value,
    header: label,
    enableSorting: false,
    meta: { label, align: "right" },
    cell: ({ row }) => <Money value={value(row.original)} muted />,
  });
  return [
    {
      id: "name",
      accessorKey: "name",
      header: t("products.product"),
      meta: { label: t("products.product") },
      cell: ({ row }) => <ProductCell p={row.original} t={t} />,
    },
    {
      id: "categoryName",
      accessorKey: "categoryName",
      header: t("products.category"),
      meta: { label: t("products.category"), className: "whitespace-nowrap" },
      cell: ({ getValue }) => getValue<string>() ?? <span className="text-muted-foreground">—</span>,
    },
    money("unitPrice", t("products.unitPrice"), (p) => p.sellPrice),
    {
      id: "stock",
      accessorKey: "stock",
      header: t("products.currentStock"),
      meta: { label: t("products.currentStock"), align: "right" },
      cell: ({ row }) => <StockCell p={row.original} t={t} f={f} />,
    },
    money("valueCost", t("products.stockValueCost"), (p) => p.stock * p.purchasePrice),
    money("valueSale", t("products.stockValueSale"), (p) => p.stock * p.sellPrice),
    money("profit", t("products.potentialProfit"), (p) => p.stock * (p.sellPrice - p.purchasePrice)),
    {
      id: "unitsSold",
      accessorKey: "unitsSold",
      header: t("products.unitsSold"),
      meta: { label: t("products.unitsSold"), align: "right" },
      cell: ({ row }) => (
        <span className="tabular">
          {f.qty(row.original.unitsSold)} {row.original.unitName}
        </span>
      ),
    },
  ];
}

export const STOCK_TOTALS: [string, (p: ProductRow) => number][] = [
  ["valueCost", (p) => p.stock * p.purchasePrice],
  ["valueSale", (p) => p.stock * p.sellPrice],
  ["profit", (p) => p.stock * (p.sellPrice - p.purchasePrice)],
];
