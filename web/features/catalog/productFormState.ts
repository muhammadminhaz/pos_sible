import type { Settings } from "@/lib/data/schemas";
import type { Lookups } from "@/lib/data/services/lookups";
import type { ProductFormData, VariationInput } from "@/lib/data/services/products";

export function blankVariation(margin = 0, name = "DUMMY"): VariationInput {
  return { name, sku: "", purchasePriceExc: 0, purchasePriceInc: 0, margin, sellPriceExc: 0, sellPriceInc: 0, groupPrices: {}, image: null, comboItems: [] };
}

export function blankProduct(settings: Settings, lookups: Lookups, locationId: string): ProductFormData {
  return {
    name: "", sku: "", barcodeType: "C128", unitId: settings.product.defaultUnitId ?? lookups.units[0]?.id ?? "", subUnitIds: [], secondaryUnitId: null,
    brandId: null, categoryId: null, subCategoryId: null, locationIds: locationId === "all" ? lookups.locations.map((l) => l.id) : [locationId],
    manageStock: true, alertQty: null, description: "", image: null, brochure: null, expiryPeriod: null, expiryPeriodType: null, enableSerial: false,
    notForSale: false, weight: "", prepTimeMinutes: null, taxId: null, taxType: "exclusive", type: "single",
    variationTemplateId: null, warrantyId: null, rack: "", row: "", position: "", customFields: ["", "", "", ""], active: true,
    variations: [blankVariation(settings.business.defaultProfitPercent)],
  };
}
