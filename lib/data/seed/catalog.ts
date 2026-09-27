import {
  brand, category, priceGroup, product, taxRate, unit, variation, variationTemplate, warranty,
  type Brand, type Category, type PriceGroup, type Product, type TaxRate, type Unit, type Variation,
  type VariationTemplate, type Warranty,
} from "@/lib/data/schemas";
import { roundMoney } from "@/lib/domain/money";
import { sellPriceFromMargin } from "@/lib/domain/pricing";
import { LOC_NIPUN, LOC_RANGO, mk, SEED_USER } from "./mk";
import type { IdFn, Rng } from "./rng";

export type Catalog = {
  units: Unit[];
  categories: Category[];
  brands: Brand[];
  warranties: Warranty[];
  priceGroups: PriceGroup[];
  variationTemplates: VariationTemplate[];
  taxRates: TaxRate[];
  products: Product[];
  variations: Variation[];
};

const U = { pcs: "unit_pcs", kg: "unit_kg", bag: "unit_bag", box: "unit_box", pack: "unit_pack", dram: "unit_dram", set: "unit_set", ltr: "unit_ltr" };
export const PG = { wholesale: "pg_wholesale", dealer: "pg_dealer" };
export const TAX = { vat5: "tax_vat5", vat75: "tax_vat75", ait2: "tax_ait2", vatAit: "tax_vat_ait" };

type Loc = "e" | "f" | "both";
type Def = {
  name: string;
  cat: string;
  sub?: string;
  brand?: string;
  unit: keyof typeof U;
  cost: [number, number];
  loc: Loc;
  tax?: string;
  warranty?: string;
  expiry?: boolean;
  variations?: { template: string; values: string[] };
};

// [key, name, parent]
const CATEGORIES: [string, string, string | null][] = [
  ["mobile", "Mobile Phones", null], ["smartphone", "Smartphones", "mobile"], ["feature", "Feature Phones", "mobile"],
  ["tv", "Televisions", null],
  ["home", "Home Appliances", null], ["fan", "Fans", "home"], ["fridge", "Refrigerators", "home"], ["iron", "Irons", "home"], ["washer", "Washing Machines", "home"],
  ["kitchen", "Kitchen Appliances", null],
  ["acc", "Mobile Accessories", null], ["charger", "Chargers", "acc"], ["cable", "Cables", "acc"], ["audio_acc", "Earphones", "acc"], ["powerbank", "Power Banks", "acc"],
  ["computer", "Computer & Networking", null],
  ["lighting", "Lighting", null],
  ["audio", "Audio", null],
  ["electrical", "Electrical", null],
  ["poultry", "Poultry Feed", null], ["broiler", "Broiler Feed", "poultry"], ["layer", "Layer Feed", "poultry"],
  ["fish", "Fish Feed", null], ["floating", "Floating Feed", "fish"], ["sinking", "Sinking Feed", "fish"],
  ["cattle", "Cattle Feed", null],
  ["medicine", "Veterinary Medicine", null],
  ["equipment", "Farm Equipment", null],
];

const BRANDS = [
  "Walton", "Samsung", "Xiaomi", "Symphony", "Vision", "Singer", "Jamuna", "Transtec", "Realme", "Oppo", "Vivo",
  "Nokia", "Philips", "Havit", "Anker", "Miyako", "A4Tech", "TP-Link",
  "Quality Feeds", "Nourish", "Aftab", "Kazi Farms", "Paragon", "CP Bangladesh", "Mega Feed",
  "ACI Animal Health", "Square", "Renata",
] as const;

const bid = (name: string) => `brand_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

function defs(): Def[] {
  const out: Def[] = [];
  const phone = (brand: string, model: string, cost: [number, number], sub = "smartphone") =>
    out.push({ name: `${brand} ${model}`, cat: "mobile", sub, brand, unit: "pcs", cost, loc: "e", tax: TAX.vat5, warranty: "w_1y" });
  phone("Samsung", "Galaxy A15", [16500, 17500]);
  phone("Samsung", "Galaxy A25 5G", [26000, 28000]);
  phone("Samsung", "Galaxy A35 5G", [36000, 38500]);
  phone("Samsung", "Galaxy M14", [15500, 16500]);
  phone("Xiaomi", "Redmi 13C", [11500, 12500]);
  phone("Xiaomi", "Redmi Note 13", [19500, 21000]);
  phone("Xiaomi", "Poco X6 Pro", [32000, 34000]);
  phone("Walton", "Primo NH5", [8500, 9200]);
  phone("Walton", "Orbit Y12", [7800, 8400]);
  phone("Realme", "C53", [13500, 14500]);
  phone("Realme", "Narzo N55", [15000, 16000]);
  phone("Oppo", "A18", [12500, 13500]);
  phone("Oppo", "A58", [18500, 19500]);
  phone("Vivo", "Y17s", [13800, 14600]);
  phone("Vivo", "Y03", [10500, 11200]);
  phone("Symphony", "Z60", [9500, 10200]);
  phone("Symphony", "B25", [1150, 1300], "feature");
  phone("Nokia", "105 (2023)", [1650, 1850], "feature");

  const e = (name: string, cat: string, brand: string | undefined, cost: [number, number], x: Partial<Def> = {}) =>
    out.push({ name, cat, brand, unit: "pcs", cost, loc: "e", ...x });
  e("Walton 32\" HD LED TV", "tv", "Walton", [15500, 16500], { tax: TAX.vat5, warranty: "w_2y" });
  e("Walton 43\" Smart Android TV", "tv", "Walton", [31000, 33000], { tax: TAX.vat5, warranty: "w_2y" });
  e("Samsung 43\" Crystal UHD TV", "tv", "Samsung", [47000, 50000], { tax: TAX.vat5, warranty: "w_2y" });
  e("Vision 32\" LED TV", "tv", "Vision", [13500, 14500], { tax: TAX.vat5, warranty: "w_1y" });
  e("Singer 40\" Smart TV", "tv", "Singer", [28000, 30000], { tax: TAX.vat5, warranty: "w_2y" });
  e("Xiaomi TV A 43", "tv", "Xiaomi", [33000, 35000], { tax: TAX.vat5, warranty: "w_1y" });
  e("Walton Refrigerator 252L", "home", "Walton", [36000, 39000], { sub: "fridge", tax: TAX.vat75, warranty: "w_5y" });
  e("Singer Refrigerator 230L", "home", "Singer", [34000, 36500], { sub: "fridge", tax: TAX.vat75, warranty: "w_5y" });
  e("Jamuna Refrigerator 215L", "home", "Jamuna", [29000, 31000], { sub: "fridge", tax: TAX.vat75, warranty: "w_5y" });
  e("Singer Washing Machine 7kg", "home", "Singer", [27000, 29000], { sub: "washer", tax: TAX.vat75, warranty: "w_2y" });
  e("Philips Dry Iron GC1905", "home", "Philips", [1650, 1850], { sub: "iron", warranty: "w_1y" });
  e("Vision Dry Iron", "home", "Vision", [950, 1100], { sub: "iron", warranty: "w_6m" });
  e("Miyako Rice Cooker 1.8L", "kitchen", "Miyako", [2100, 2400], { warranty: "w_1y" });
  e("Walton Rice Cooker 2.8L", "kitchen", "Walton", [2600, 2900], { warranty: "w_1y" });
  e("Vision Blender 3 in 1", "kitchen", "Vision", [2800, 3100], { warranty: "w_1y" });
  e("Walton Electric Kettle 1.5L", "kitchen", "Walton", [1050, 1200], { warranty: "w_6m" });
  e("Miyako Gas Stove Double", "kitchen", "Miyako", [3400, 3800], { warranty: "w_1y" });
  e("Walton Microwave Oven 20L", "kitchen", "Walton", [8200, 8900], { tax: TAX.vat5, warranty: "w_1y" });
  e("Anker 20W USB-C Charger", "acc", "Anker", [1150, 1300], { sub: "charger", loc: "both", warranty: "w_6m" });
  e("Xiaomi 33W Fast Charger", "acc", "Xiaomi", [900, 1050], { sub: "charger", loc: "both" });
  e("Samsung 25W Adapter", "acc", "Samsung", [1300, 1450], { sub: "charger" });
  e("Havit Type-C Cable 1m", "acc", "Havit", [160, 200], { sub: "cable", loc: "both" });
  e("Anker PowerLine USB-C Cable", "acc", "Anker", [550, 650], { sub: "cable" });
  e("OTG Adapter Type-C", "acc", undefined, [60, 90], { sub: "cable" });
  e("Xiaomi Redmi Buds 5", "acc", "Xiaomi", [2300, 2600], { sub: "audio_acc", warranty: "w_6m" });
  e("Havit H2002d Headphone", "acc", "Havit", [1900, 2150], { sub: "audio_acc", warranty: "w_6m" });
  e("Xiaomi Power Bank 10000mAh", "acc", "Xiaomi", [1350, 1500], { sub: "powerbank", warranty: "w_6m" });
  e("Anker PowerCore 20000mAh", "acc", "Anker", [3200, 3500], { sub: "powerbank", warranty: "w_1y" });
  e("Walton Tamarind Laptop i5", "computer", "Walton", [52000, 56000], { tax: TAX.vat5, warranty: "w_2y" });
  e("Havit KB272 Keyboard", "computer", "Havit", [420, 500] );
  e("Havit MS1003 Mouse", "computer", "Havit", [230, 280]);
  e("A4Tech OP-620D Mouse", "computer", "A4Tech", [320, 380]);
  e("TP-Link Archer C6 Router", "computer", "TP-Link", [2700, 3000], { warranty: "w_1y" });
  e("Transtec LED Tube Light 20W", "lighting", "Transtec", [260, 320], { warranty: "w_6m" });
  e("Walton Rechargeable Emergency Light", "lighting", "Walton", [850, 980], { warranty: "w_6m" });
  e("Havit SK706 Bluetooth Speaker", "audio", "Havit", [1350, 1550], { warranty: "w_6m" });
  e("Xiaomi Mi Portable Speaker", "audio", "Xiaomi", [2700, 3000], { warranty: "w_6m" });

  const feedBrands = ["Quality Feeds", "Nourish", "Aftab", "Kazi Farms", "Paragon"];
  const poultry: [string, string, [number, number]][] = [
    ["Broiler Starter", "broiler", [68, 72]], ["Broiler Grower", "broiler", [65, 69]], ["Broiler Finisher", "broiler", [63, 67]],
    ["Layer Starter", "layer", [60, 64]], ["Layer Grower", "layer", [57, 61]], ["Layer Production", "layer", [55, 59]],
  ];
  for (const b of feedBrands)
    for (const [n, sub, cost] of poultry)
      out.push({ name: `${b} ${n}`, cat: "poultry", sub, brand: b, unit: "kg", cost, loc: "f", expiry: true });
  for (const b of ["CP Bangladesh", "Mega Feed", "Quality Feeds"])
    for (const [n, sub, cost] of [["Floating Nursery", "floating", [72, 78]], ["Floating Grower", "floating", [58, 63]], ["Sinking Grower", "sinking", [46, 50]]] as const)
      out.push({ name: `${b} Fish Feed ${n}`, cat: "fish", sub, brand: b, unit: "kg", cost: [...cost], loc: "f", expiry: true });
  const f = (name: string, cat: string, brand: string | undefined, unit: keyof typeof U, cost: [number, number], expiry = true) =>
    out.push({ name, cat, brand, unit, cost, loc: "f", expiry });
  f("Kazi Farms Dairy Cattle Feed", "cattle", "Kazi Farms", "kg", [48, 52]);
  f("Aftab Cattle Feed Special", "cattle", "Aftab", "kg", [46, 50]);
  f("Wheat Bran (Bhushi)", "cattle", undefined, "kg", [42, 46]);
  f("Rice Polish", "cattle", undefined, "kg", [30, 34]);
  f("Mustard Oil Cake (Khoil)", "cattle", undefined, "kg", [52, 56]);
  f("Renamycin Soluble Powder 100g", "medicine", "Renata", "pack", [180, 210]);
  f("Vitamin AD3E Liquid 1L", "medicine", "Square", "ltr", [520, 580]);
  f("Electromin Powder 1kg", "medicine", "Renata", "pack", [240, 280]);
  f("Tylosin Powder 100g", "medicine", "ACI Animal Health", "pack", [320, 360]);
  f("Doxy-A Vet Powder 100g", "medicine", "ACI Animal Health", "pack", [290, 330]);
  f("Calcium Plus Liquid 1L", "medicine", "Square", "ltr", [390, 430]);
  f("Neoceryl Vet Powder 100g", "medicine", "Renata", "pack", [210, 240]);
  f("Egg Tray (30 pcs)", "equipment", undefined, "pack", [95, 115], false);
  f("Brooder Lamp 100W", "equipment", "Transtec", "pcs", [120, 150], false);

  // Variable products
  const v = (name: string, cat: string, brand: string | undefined, unitKey: keyof typeof U, cost: [number, number], loc: Loc, template: string, values: string[], warrantyId?: string) =>
    out.push({ name, cat, brand, unit: unitKey, cost, loc, warranty: warrantyId, variations: { template, values } });
  v("Walton Ceiling Fan 56\"", "home", "Walton", "pcs", [3300, 3600], "e", "vt_color", ["White", "Brown", "Ivory"], "w_2y");
  v("Vision Table Fan 16\"", "home", "Vision", "pcs", [2200, 2450], "e", "vt_color", ["White", "Blue"], "w_1y");
  v("Transtec LED Bulb", "lighting", "Transtec", "pcs", [110, 190], "both", "vt_watt", ["12W", "15W", "20W"], "w_6m");
  v("Walton Extension Board", "electrical", "Walton", "pcs", [380, 560], "both", "vt_size", ["4 Port", "6 Port"]);
  v("Phone Back Case", "acc", undefined, "pcs", [90, 140], "e", "vt_color", ["Black", "Clear", "Blue"]);
  v("Havit E48 Earphone", "acc", "Havit", "pcs", [240, 280], "e", "vt_color", ["Black", "White"]);
  v("Poultry Feeder Tray", "equipment", undefined, "pcs", [140, 260], "f", "vt_size", ["S", "M", "L"]);
  v("Poultry Drinker", "equipment", undefined, "pcs", [160, 320], "f", "vt_size", ["3L", "5L", "8L"]);
  for (const d of out) if (d.cat === "home" && !d.sub && d.name.includes("Fan")) d.sub = "fan";
  return out;
}

const pad = (n: number) => String(n).padStart(4, "0");

export function createCatalog(r: Rng, id: IdFn, createdAt: string): Catalog {
  const base = { createdAt, createdBy: SEED_USER };

  const units: Unit[] = [
    mk(unit, { ...base, id: U.pcs, name: "Pieces", shortName: "Pc(s)", allowDecimal: false }),
    mk(unit, { ...base, id: U.kg, name: "Kilogram", shortName: "KG", allowDecimal: true }),
    mk(unit, { ...base, id: U.bag, name: "Bag", shortName: "Bag", allowDecimal: false, baseUnitId: U.kg, multiplier: 50 }),
    mk(unit, { ...base, id: U.box, name: "Box", shortName: "Box", allowDecimal: false }),
    mk(unit, { ...base, id: U.pack, name: "Packet", shortName: "Pkt", allowDecimal: false }),
    mk(unit, { ...base, id: U.dram, name: "Dram", shortName: "Dram", allowDecimal: false, baseUnitId: U.kg, multiplier: 185 }),
    mk(unit, { ...base, id: U.set, name: "Set", shortName: "Set", allowDecimal: false }),
    mk(unit, { ...base, id: U.ltr, name: "Litre", shortName: "Ltr", allowDecimal: true }),
  ];

  const categories = CATEGORIES.map(([key, name, parent], i) =>
    mk(category, { ...base, id: `cat_${key}`, name, code: `C${pad(i + 1)}`, parentId: parent ? `cat_${parent}` : null }),
  );

  const brands = BRANDS.map((name) => mk(brand, { ...base, id: bid(name), name }));

  const warranties = [
    mk(warranty, { ...base, id: "w_6m", name: "6 Months", description: "Service warranty", duration: 6, durationType: "months" }),
    mk(warranty, { ...base, id: "w_1y", name: "1 Year", description: "Official brand warranty", duration: 1, durationType: "years" }),
    mk(warranty, { ...base, id: "w_2y", name: "2 Years", description: "Official brand warranty", duration: 2, durationType: "years" }),
    mk(warranty, { ...base, id: "w_5y", name: "5 Years Compressor", description: "Compressor only", duration: 5, durationType: "years" }),
  ];

  const priceGroups = [
    mk(priceGroup, { ...base, id: PG.wholesale, name: "Wholesale", description: "Bulk buyers and retailers" }),
    mk(priceGroup, { ...base, id: PG.dealer, name: "Dealer", description: "Authorised dealers" }),
  ];

  const variationTemplates = [
    mk(variationTemplate, { ...base, id: "vt_color", name: "Color", values: ["White", "Brown", "Ivory", "Blue", "Black", "Clear"] }),
    mk(variationTemplate, { ...base, id: "vt_size", name: "Size", values: ["S", "M", "L", "3L", "5L", "8L", "4 Port", "6 Port"] }),
    mk(variationTemplate, { ...base, id: "vt_watt", name: "Wattage", values: ["12W", "15W", "20W"] }),
  ];

  const taxRates = [
    mk(taxRate, { ...base, id: TAX.vat5, name: "VAT 5%", rate: 5 }),
    mk(taxRate, { ...base, id: TAX.vat75, name: "VAT 7.5%", rate: 7.5 }),
    mk(taxRate, { ...base, id: TAX.ait2, name: "AIT 2%", rate: 2 }),
    mk(taxRate, { ...base, id: TAX.vatAit, name: "VAT+AIT", rate: 7, isGroup: true, subTaxIds: [TAX.vat5, TAX.ait2] }),
  ];
  const taxRateOf = (tid?: string | null) => taxRates.find((t) => t.id === tid)?.rate ?? 0;

  const products: Product[] = [];
  const variations: Variation[] = [];
  const locIds = (l: Loc) => (l === "e" ? [LOC_RANGO] : l === "f" ? [LOC_NIPUN] : [LOC_RANGO, LOC_NIPUN]);

  const priceVariation = (productId: string, sku: string, name: string, costExc: number, taxId: string | null, wholesale: boolean) => {
    const rate = taxRateOf(taxId);
    const margin = costExc > 10000 ? r.int(8, 14) : costExc > 1000 ? r.int(15, 25) : costExc > 200 ? r.int(25, 40) : r.int(10, 20);
    const sellExc = roundMoney(sellPriceFromMargin(costExc, margin), 0);
    return mk(variation, {
      ...base,
      id: id("v"),
      productId,
      name,
      sku,
      purchasePriceExc: costExc,
      purchasePriceInc: roundMoney(costExc * (1 + rate / 100)),
      margin,
      sellPriceExc: sellExc,
      sellPriceInc: roundMoney(sellExc * (1 + rate / 100)),
      groupPrices: wholesale
        ? { [PG.wholesale]: roundMoney(sellExc * 0.96, 0), [PG.dealer]: roundMoney(sellExc * 0.93, 0) }
        : {},
    });
  };

  defs().forEach((d, i) => {
    const pid = id("p");
    const sku = pad(i + 1);
    const isVar = !!d.variations;
    const taxId = d.tax ?? null;
    products.push(
      mk(product, {
        ...base,
        id: pid,
        name: d.name,
        sku,
        barcodeType: "C128",
        unitId: U[d.unit],
        subUnitIds: d.unit === "kg" ? [U.bag, U.dram] : [],
        brandId: d.brand ? bid(d.brand) : null,
        categoryId: `cat_${d.cat}`,
        subCategoryId: d.sub ? `cat_${d.sub}` : null,
        locationIds: locIds(d.loc),
        manageStock: true,
        alertQty: d.unit === "kg" ? 500 : d.cost[0] > 10000 ? 3 : 10,
        description: "",
        expiryPeriod: d.expiry ? (d.cat === "medicine" ? 24 : 4) : null,
        expiryPeriodType: d.expiry ? "months" : null,
        enableSerial: d.cat === "mobile" && d.sub === "smartphone",
        taxId,
        taxType: taxId ? "inclusive" : "exclusive",
        type: isVar ? "variable" : "single",
        variationTemplateId: d.variations?.template ?? null,
        warrantyId: d.warranty ?? null,
        rack: d.loc === "f" ? `R${r.int(1, 6)}` : `S${r.int(1, 12)}`,
        row: String(r.int(1, 5)),
        position: String(r.int(1, 10)),
      }),
    );
    const wholesale = d.loc !== "e" || d.cat === "acc";
    if (!isVar) {
      variations.push(priceVariation(pid, sku, "DUMMY", r.money(d.cost[0], d.cost[1]), taxId, wholesale));
    } else {
      const vals = d.variations!.values;
      vals.forEach((val, j) => {
        const step = vals.length > 1 ? (d.cost[1] - d.cost[0]) / (vals.length - 1) : 0;
        variations.push(priceVariation(pid, `${sku}-${j + 1}`, val, roundMoney(d.cost[0] + step * j, 0), taxId, wholesale));
      });
    }
  });

  // Combos
  const findV = (productName: string, varName = "DUMMY") => {
    const p = products.find((x) => x.name === productName)!;
    return variations.find((x) => x.productId === p.id && x.name === varName)!;
  };
  const combos: { name: string; cat: string; loc: Loc; items: [Variation, number][] }[] = [
    { name: "Smartphone Starter Bundle", cat: "mobile", loc: "e", items: [[findV("Xiaomi Redmi 13C"), 1], [findV("Xiaomi 33W Fast Charger"), 1], [findV("Phone Back Case", "Clear"), 1]] },
    { name: "Broiler Starter Kit", cat: "poultry", loc: "f", items: [[findV("Nourish Broiler Starter"), 50], [findV("Poultry Feeder Tray", "M"), 2], [findV("Poultry Drinker", "5L"), 2]] },
    { name: "Home Lighting Pack", cat: "lighting", loc: "both", items: [[findV("Transtec LED Bulb", "15W"), 4]] },
  ];
  combos.forEach((c) => {
    const pid = id("p");
    const sku = pad(products.length + 1);
    products.push(
      mk(product, {
        ...base, id: pid, name: c.name, sku, barcodeType: "C128", unitId: U.set, categoryId: `cat_${c.cat}`,
        locationIds: locIds(c.loc), manageStock: false, taxType: "exclusive", type: "combo",
      }),
    );
    const cost = roundMoney(c.items.reduce((s, [vv, q]) => s + vv.purchasePriceExc * q, 0));
    const sell = roundMoney(c.items.reduce((s, [vv, q]) => s + vv.sellPriceExc * q, 0) * 0.95, 0);
    variations.push(
      mk(variation, {
        ...base, id: id("v"), productId: pid, name: "DUMMY", sku,
        purchasePriceExc: cost, purchasePriceInc: cost, margin: roundMoney(((sell - cost) / cost) * 100),
        sellPriceExc: sell, sellPriceInc: sell,
        comboItems: c.items.map(([vv, q]) => ({ variationId: vv.id, qty: q, unitId: products.find((p) => p.id === vv.productId)!.unitId })),
      }),
    );
  });

  return { units, categories, brands, warranties, priceGroups, variationTemplates, taxRates, products, variations };
}
