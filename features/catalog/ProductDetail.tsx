"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CopyIcon, PackagePlusIcon, PencilIcon, TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useProduct, useProductHistory, useProductStock } from "@/lib/data/hooks/products";
import { useFormat } from "@/lib/i18n/format";
import { OpeningStockDialog } from "./OpeningStockDialog";
import { Section } from "./formParts";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export function ProductDetail({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const params = useSearchParams();
  const { data: p, isError } = useProduct(id);
  const { data: lookups } = useLookups();
  const { data: stock = [] } = useProductStock(id);
  const { data: history = [] } = useProductHistory(id);
  const [opening, setOpening] = useState(params.get("opening") === "1");
  if (isError) return <EmptyState title={t("errors.notFound")} />;
  if (!p) return <Skeleton className="h-96" />;
  const groups = lookups?.priceGroups ?? [];
  const warranty = lookups?.warranties.find((w) => w.id === p.warrantyId)?.name;
  const subCategory = lookups?.categories.find((c) => c.id === p.subCategoryId)?.name;

  return (
    <div className="grid gap-4">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{p.name}<Badge variant={p.active ? "secondary" : "outline"}>{p.active ? t("common.active") : t("common.inactive")}</Badge></span>}
        description={`${t("products.sku")}: ${p.sku}`}
        actions={
          <>
            {can("product.update") && <Button asChild variant="outline"><Link href={`/products/${id}/edit`}><PencilIcon />{t("common.edit")}</Link></Button>}
            {can("product.create") && <Button asChild variant="outline"><Link href={`/products/new?duplicate=${id}`}><CopyIcon />{t("common.duplicate")}</Link></Button>}
            <Button asChild variant="outline"><Link href={`/products/labels?product=${id}`}><TagIcon />{t("products.labels")}</Link></Button>
            {can("product.opening_stock") && p.manageStock && <Button onClick={() => setOpening(true)}><PackagePlusIcon />{t("products.openingStock")}</Button>}
          </>
        }
      />

      <Section title={t("catalog.details")}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="row-span-2 size-24 rounded-lg border object-cover" />
          )}
          <Fact label={t("products.type")} value={t(`products.${p.type}`)} />
          <Fact label={t("products.unit")} value={p.unitName} />
          <Fact label={t("products.brand")} value={p.brandName} />
          <Fact label={t("products.category")} value={[p.categoryName, subCategory].filter(Boolean).join(" › ")} />
          <Fact label={t("products.tax")} value={p.taxName ? `${p.taxName} (${t(`catalog.${p.taxType}`)})` : ""} />
          <Fact label={t("products.locations")} value={p.locationNames.join(", ")} />
          <Fact label={t("catalog.warranty")} value={warranty} />
          <Fact label={t("catalog.alertQty")} value={p.alertQty != null ? f.qty(p.alertQty) : ""} />
          <Fact label={t("products.currentStock")} value={p.manageStock ? f.qty(p.stock) : t("products.noStock")} />
          <Fact label={t("catalog.barcodeType")} value={p.barcodeType} />
          <Fact label={t("catalog.weight")} value={p.weight} />
          <Fact label={t("products.notForSelling")} value={p.notForSale ? t("common.yes") : t("common.no")} />
        </dl>
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
      </Section>

      <Section title={t("catalog.variations")}>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("catalog.variationName")}</TableHead>
                <TableHead>{t("products.sku")}</TableHead>
                <TableHead className="text-right">{t("catalog.purchaseExc")}</TableHead>
                <TableHead className="text-right">{t("catalog.sellExc")}</TableHead>
                <TableHead className="text-right">{t("catalog.sellInc")}</TableHead>
                {groups.map((g) => <TableHead key={g.id} className="text-right">{g.name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.variations.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{v.name === "DUMMY" ? "—" : v.name}</TableCell>
                  <TableCell className="tabular">{v.sku}</TableCell>
                  <TableCell className="text-right tabular">{f.money(v.purchasePriceExc)}</TableCell>
                  <TableCell className="text-right tabular">{f.money(v.sellPriceExc)}</TableCell>
                  <TableCell className="text-right tabular">{f.money(v.sellPriceInc)}</TableCell>
                  {groups.map((g) => <TableCell key={g.id} className="text-right tabular">{v.groupPrices[g.id] != null ? f.money(v.groupPrices[g.id]) : "—"}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      {p.manageStock && (
        <Section title={t("catalog.stockByLocation")}>
          {stock.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("catalog.noStock")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.location")}</TableHead>
                  <TableHead>{t("catalog.variationName")}</TableHead>
                  <TableHead className="text-right">{t("catalog.qty")}</TableHead>
                  <TableHead className="text-right">{t("catalog.valueAtCost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{r.locationName}</TableCell>
                    <TableCell>{r.variationName === "DUMMY" ? "—" : r.variationName}</TableCell>
                    <TableCell className="text-right tabular">{f.qty(r.qty)}</TableCell>
                    <TableCell className="text-right tabular">{f.money(r.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}

      <Section title={t("products.stockHistory")}>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("catalog.noHistory")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("catalog.movement")}</TableHead>
                <TableHead>{t("catalog.reference")}</TableHead>
                <TableHead>{t("common.location")}</TableHead>
                <TableHead>{t("catalog.variationName")}</TableHead>
                <TableHead className="text-right">{t("catalog.change")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history].reverse().map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="tabular whitespace-nowrap">{f.dateTime(r.date)}</TableCell>
                  <TableCell>{t(`catalog.kind.${r.kind}`)}</TableCell>
                  <TableCell className="tabular">{r.refNo || "—"}</TableCell>
                  <TableCell>{r.locationName}</TableCell>
                  <TableCell>{r.variationName === "DUMMY" ? "—" : r.variationName}</TableCell>
                  <TableCell className={`text-right tabular ${r.delta < 0 ? "text-danger" : "text-success"}`}>{r.delta > 0 ? "+" : ""}{f.qty(r.delta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <OpeningStockDialog productId={opening ? id : null} onClose={() => setOpening(false)} />
    </div>
  );
}
