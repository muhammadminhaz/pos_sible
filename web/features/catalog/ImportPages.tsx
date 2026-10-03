"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { downloadCSV, toCSV } from "@/components/shared/DataTable";
import { useLookups } from "@/lib/data/hooks/lookups";
import { OPENING_IMPORT_COLUMNS, PRODUCT_IMPORT_COLUMNS, productImportService } from "@/lib/data/services/productImport";
import { priceSheetService } from "@/lib/data/services/priceSheet";
import { useFormat } from "@/lib/i18n/format";
import { ImportWizard } from "./ImportWizard";

export function ImportProductsPage() {
  const t = useTranslations();
  const f = useFormat();
  const { data: lookups } = useLookups();
  return (
    <ImportWizard
      title={t("nav.importProducts")} description={t("catalog.importProductsDescription")} hint={t("catalog.importProductsHint")}
      columns={PRODUCT_IMPORT_COLUMNS} templateName="products-import-template" historyKind="products"
      parse={productImportService.parseProducts} commit={productImportService.commitProducts}
      preview={{
        headers: [t("catalog.productName"), t("products.sku"), t("products.unit"), t("catalog.purchaseExc"), t("catalog.sellExc")],
        cells: ({ input: i }) => [i.name, i.sku || t("catalog.autoSku"), lookups?.units.find((u) => u.id === i.unitId)?.name ?? "", f.money(i.variations[0].purchasePriceExc), f.money(i.variations[0].sellPriceExc)],
      }}
    />
  );
}

export function ImportOpeningStockPage() {
  const t = useTranslations();
  const f = useFormat();
  return (
    <ImportWizard
      title={t("nav.importOpeningStock")} description={t("catalog.importOpeningDescription")} hint={t("catalog.importOpeningHint")}
      columns={OPENING_IMPORT_COLUMNS} templateName="opening-stock-import-template" historyKind="opening_stock"
      parse={productImportService.parseOpeningStock} commit={productImportService.commitOpeningStock}
      preview={{
        headers: [t("products.sku"), t("catalog.qty"), t("catalog.unitCost"), t("catalog.lotNo")],
        cells: ({ sku, stock: s }) => [sku, f.qty(s.qty), f.money(s.unitCost), s.lotNo || "—"],
      }}
    />
  );
}

export function UpdatePricePage() {
  const t = useTranslations();
  const f = useFormat();
  return (
    <ImportWizard
      title={t("nav.updatePrice")} description={t("catalog.updatePriceDescription")} hint={t("catalog.updatePriceHint")}
      columns={["sku", "purchase_exc", "sell_exc", "sell_inc"]} templateName="price-update-template" historyKind="prices"
      parse={priceSheetService.parse} commit={priceSheetService.apply}
      preview={{
        headers: [t("products.sku"), t("catalog.purchaseExc"), t("catalog.sellExc"), t("catalog.sellInc"), t("catalog.groupPrices")],
        cells: (r) => [r.sku, r.purchaseExc != null ? f.money(r.purchaseExc) : "—", r.sellExc != null ? f.money(r.sellExc) : "—", r.sellInc != null ? f.money(r.sellInc) : "—", f.number(Object.keys(r.groups).length)],
      }}
      actions={
        <Button variant="outline" onClick={async () => downloadCSV("current-prices", toCSV(await priceSheetService.exportRows()))}>
          <DownloadIcon />{t("catalog.exportPrices")}
        </Button>
      }
    />
  );
}
