"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DownloadIcon,
  MapPinMinusIcon,
  MapPinPlusIcon,
  PackageIcon,
  PlusIcon,
  PowerOffIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, downloadCSV, exportFileName, toCSV, useTableQuery, type TableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/lib/auth/useCan";
import { AppError } from "@/lib/data/errors";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { useProductMutations, useProducts } from "@/lib/data/hooks/products";
import { productsService, type ProductFilters, type ProductRow } from "@/lib/data/services/products";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { LocationDialog } from "./LocationDialog";
import { productColumns, STOCK_TOTALS, stockColumns } from "./columns";

type UrlFilters = {
  tab?: "stock";
  type?: ProductFilters["type"];
  category?: string;
  unit?: string;
  tax?: string;
  brand?: string;
  location?: string;
  active?: "active" | "inactive";
  notForSale?: "1";
};

const FILTER_KEYS = ["type", "category", "unit", "tax", "brand", "location", "active", "notForSale"] as const;

function toFilters(u: UrlFilters, globalLocation: string, q: TableQuery): ProductFilters {
  return {
    search: q.search || undefined,
    page: q.page,
    pageSize: q.pageSize,
    sort: q.sort,
    type: u.type,
    categoryId: u.category,
    unitId: u.unit,
    taxId: u.tax,
    brandId: u.brand,
    locationId: u.location ?? (globalLocation === "all" ? undefined : globalLocation),
    active: u.active,
    notForSale: u.notForSale ? true : undefined,
  };
}

const errorMessage = (e: unknown, t: ReturnType<typeof useTranslations>) =>
  e instanceof AppError && e.code === "product_in_use" ? t("products.inUse") : e instanceof Error ? e.message : t("errors.generic");

export function ProductsList() {
  const t = useTranslations();
  const { data: settings } = useSettings();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const globalLocation = useUI((s) => s.locationId);
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>([...FILTER_KEYS]);
  const tab = url.tab === "stock" ? "stock" : "all";

  const [query, setQuery] = useTableQuery("products");
  const [stockQuery, setStockQuery] = useTableQuery("products-stock");
  const activeQuery = tab === "stock" ? stockQuery : query;
  const filters = toFilters(url, globalLocation, activeQuery);
  const list = useProducts(filters);
  const m = useProductMutations();

  const [toDelete, setToDelete] = useState<{ rows: ProductRow[]; clear?: () => void } | null>(null);
  const [locationMode, setLocationMode] = useState<{ mode: "add" | "remove"; rows: ProductRow[]; clear: () => void } | null>(null);

  const allRows = () => productsService.list({ ...filters, page: 0, pageSize: -1 }).then((r) => r.rows);

  const toggleActive = async (p: ProductRow) => {
    await m.setActive.mutateAsync({ ids: [p.id], active: !p.active });
    toast.success(p.active ? t("products.deactivated", { count: 1 }) : t("products.activated"));
  };

  const columns = useMemo(
    () => productColumns(t, f, { can, onToggleActive: toggleActive, onDelete: (p) => setToDelete({ rows: [p] }) }),
    // toggleActive only closes over stable mutation handles and t.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, f, can],
  );
  const stockCols = useMemo(() => stockColumns(t, f), [t, f]);

  const resetFilters = () => {
    resetUrl();
    setQuery({ page: 0 });
    setStockQuery({ page: 0 });
  };

  const defs: FilterDef[] = [
    {
      key: "type",
      label: t("products.type"),
      type: "select",
      options: (["single", "variable", "combo"] as const).map((v) => ({ value: v, label: t(`products.${v}`) })),
    },
    {
      key: "category",
      label: t("products.category"),
      type: "select",
      options: (lookups?.categories ?? []).map((c) => ({ value: c.id, label: c.parentId ? `— ${c.name}` : c.name })),
    },
    { key: "unit", label: t("products.unit"), type: "select", options: (lookups?.units ?? []).map((u) => ({ value: u.id, label: u.name })) },
    { key: "tax", label: t("products.tax"), type: "select", options: (lookups?.taxRates ?? []).map((x) => ({ value: x.id, label: x.name })) },
    { key: "brand", label: t("products.brand"), type: "select", options: (lookups?.brands ?? []).map((b) => ({ value: b.id, label: b.name })) },
    {
      key: "location",
      label: t("common.location"),
      type: "select",
      options: (lookups?.locations ?? []).map((l) => ({ value: l.id, label: l.name })),
    },
    {
      key: "active",
      label: t("products.activeState"),
      type: "select",
      options: [
        { value: "active", label: t("common.active") },
        { value: "inactive", label: t("common.inactive") },
      ],
    },
    { key: "notForSale", label: t("products.notForSelling"), type: "toggle" },
  ];

  const exportAll = async () => {
    const rows = await productsService.list({ pageSize: -1 }).then((r) => r.rows);
    const records = rows.map((p) => ({
      [t("products.product")]: p.name,
      [t("products.sku")]: p.sku,
      [t("products.type")]: t(`products.${p.type}`),
      [t("products.unit")]: p.unitName,
      [t("products.category")]: p.categoryName ?? "",
      [t("products.brand")]: p.brandName ?? "",
      [t("products.tax")]: p.taxName ?? "",
      [t("products.purchasePrice")]: p.purchasePrice,
      [t("products.sellingPrice")]: p.sellPrice,
      [t("products.currentStock")]: p.stock,
      [t("products.locations")]: p.locationNames.join(", "),
      [t("common.status")]: p.active ? t("common.active") : t("common.inactive"),
    }));
    downloadCSV(exportFileName("products", settings?.business.name), toCSV(records));
  };

  const onPageChange = (q: Partial<TableQuery>) => (tab === "stock" ? setStockQuery(q) : setQuery(q));
  const onFilterChange = (patch: Partial<UrlFilters>) => {
    setUrl(patch);
    onPageChange({ page: 0 });
  };

  const empty = (
    <EmptyState
      icon={PackageIcon}
      title={t("products.empty")}
      description={t("products.emptyHint")}
      action={
        can("product.create") && (
          <Button asChild>
            <Link href="/products/new">
              <PlusIcon />
              {t("nav.addProduct")}
            </Link>
          </Button>
        )
      }
    />
  );

  const hasFilters = FILTER_KEYS.some((k) => url[k]) || !!activeQuery.search;

  return (
    <>
      <PageHeader
        title={t("products.title")}
        description={t("products.description")}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {t("common.more")}
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {can("product.create") && (
                  <DropdownMenuItem asChild>
                    <Link href="/products/import">
                      <UploadIcon />
                      {t("nav.importProducts")}
                    </Link>
                  </DropdownMenuItem>
                )}
                {can("product.opening_stock") && (
                  <DropdownMenuItem asChild>
                    <Link href="/products/import-opening-stock">
                      <UploadIcon />
                      {t("nav.importOpeningStock")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={exportAll}>
                  <DownloadIcon />
                  {t("products.exportProducts")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {can("product.create") && (
              <Button asChild>
                <Link href="/products/new">
                  <PlusIcon />
                  {t("nav.addProduct")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v === "stock" ? "stock" : undefined })}>
          <TabsList>
            <TabsTrigger value="all">{t("products.allProducts")}</TabsTrigger>
            <TabsTrigger value="stock">{t("products.stockReport")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <FilterBar defs={defs} value={url} onChange={onFilterChange} onReset={resetFilters} />
      </div>

      {tab === "all" ? (
        <DataTable
          key="all"
          tableId="products"
          columns={columns}
          data={list.data?.rows ?? []}
          total={list.data?.total ?? 0}
          loading={list.isFetching}
          query={query}
          onQueryChange={setQuery}
          exportName="products"
          exportRows={allRows}
          defaultHidden={["sku", "taxName"]}
          onRowClick={(p) => router.push(`/products/${p.id}`)}
          empty={hasFilters ? undefined : empty}
          selectable
          bulkActions={(rows, clear) => (
            <>
              {can("product.update") && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setLocationMode({ mode: "add", rows, clear })}>
                    <MapPinPlusIcon />
                    {t("products.addToLocation")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setLocationMode({ mode: "remove", rows, clear })}>
                    <MapPinMinusIcon />
                    {t("products.removeFromLocation")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await m.setActive.mutateAsync({ ids: rows.map((r) => r.id), active: false });
                      toast.success(t("products.deactivated", { count: rows.length }));
                      clear();
                    }}
                  >
                    <PowerOffIcon />
                    {t("products.deactivateSelected")}
                  </Button>
                </>
              )}
              {can("product.delete") && (
                <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setToDelete({ rows, clear })}>
                  <Trash2Icon />
                  {t("products.deleteSelected")}
                </Button>
              )}
            </>
          )}
        />
      ) : (
        <DataTable
          key="stock"
          tableId="products-stock"
          columns={stockCols}
          data={list.data?.rows ?? []}
          total={list.data?.total ?? 0}
          loading={list.isFetching}
          query={stockQuery}
          onQueryChange={setStockQuery}
          exportName="stock-report"
          exportRows={allRows}
          onRowClick={(p) => router.push(`/products/${p.id}`)}
          footer={(rows) => ({
            name: t("common.total"),
            ...Object.fromEntries(STOCK_TOTALS.map(([id, fn]) => [id, <Money key={id} value={rows.reduce((s, r) => s + fn(r), 0)} />])),
          })}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t("products.deleteTitle", { count: toDelete?.rows.length ?? 0 })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await m.remove.mutateAsync(toDelete.rows.map((r) => r.id));
            toast.success(t("products.deleted", { count: toDelete.rows.length }));
            toDelete.clear?.();
          } catch (e) {
            toast.error(errorMessage(e, t));
          }
        }}
      />

      <LocationDialog
        mode={locationMode?.mode ?? null}
        count={locationMode?.rows.length ?? 0}
        locations={lookups?.locations ?? []}
        onOpenChange={(o) => !o && setLocationMode(null)}
        onSubmit={async (locationIds) => {
          if (!locationMode) return;
          await m.setLocations.mutateAsync({ ids: locationMode.rows.map((r) => r.id), locationIds, mode: locationMode.mode });
          toast.success(t("products.locationsUpdated"));
          locationMode.clear();
        }}
      />
    </>
  );
}
