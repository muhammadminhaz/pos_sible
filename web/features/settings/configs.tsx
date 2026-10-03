"use client";

import { crudPerm } from "@/lib/auth/permissions";
import { BarcodeIcon, BuildingIcon, FileTextIcon, PercentIcon, PrinterIcon, ReceiptIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { CrudPage, type CrudConfig, type FieldDef } from "@/features/catalog/CrudPage";
import { useLookups } from "@/lib/data/hooks/lookups";
import { PAYMENT_METHODS } from "@/lib/data/schemas";
import { LayoutPreview } from "./LayoutPreview";

type T = ReturnType<typeof useTranslations>;

const f = (t: T, key: string, type: FieldDef["type"], extra: Partial<FieldDef> = {}): FieldDef => ({ key, type, label: t(`settings.f.${key}`), ...extra });
const activeBadge = (t: T, on: boolean) => <Badge variant={on ? "secondary" : "outline"}>{on ? t("common.active") : t("common.inactive")}</Badge>;
/** The sellable modules a business owner can hand out per person; labelled with the matching menu name. */
const MODULE_OPTIONS = ["pos", "sales", "purchases", "stock", "expenses", "accounts", "reports"];
const cap = (v: string) => v[0].toUpperCase() + v.slice(1);
const yes = (t: T, v: boolean) => (v ? t("common.yes") : "");

export function TaxRatesPage() {
  const t = useTranslations();
  const { data } = useLookups();
  const plain = (data?.taxRates ?? []).filter((x) => !x.isGroup);
  const cfg: CrudConfig<"taxRates"> = {
    table: "taxRates", permission: "settings.tax", title: t("nav.taxRates"), description: t("settings.taxRatesDescription"), icon: PercentIcon,
    addLabel: t("settings.addTaxRate"), editLabel: t("settings.editTaxRate"), emptyTitle: t("settings.noTaxRates"),
    columns: [
      { key: "name", label: t("settings.f.name") },
      { key: "rate", label: t("settings.f.rate"), align: "right", render: (r) => `${r.rate}%` },
      { key: "isGroup", label: t("settings.f.isGroup"), render: (r) => yes(t, r.isGroup), csv: (r) => r.isGroup },
    ],
    fields: [
      f(t, "name", "text", { required: true }),
      f(t, "isGroup", "switch"),
      f(t, "rate", "number", { required: true, min: 0, initial: 0, show: (v) => !v.isGroup }),
      f(t, "subTaxIds", "multi", { show: (v) => !!v.isGroup, options: ({ id }) => plain.filter((x) => x.id !== id).map((x) => ({ value: x.id, label: `${x.name} (${x.rate}%)` })) }),
    ],
    defaults: { subTaxIds: [] },
  };
  return <CrudPage cfg={cfg} />;
}

export function PrintersPage() {
  const t = useTranslations();
  const cfg: CrudConfig<"printers"> = {
    table: "printers", permission: "settings.printer", title: t("nav.printers"), description: t("settings.printersDescription"), icon: PrinterIcon,
    addLabel: t("settings.addPrinter"), editLabel: t("settings.editPrinter"), emptyTitle: t("settings.noPrinters"),
    columns: [
      { key: "name", label: t("settings.f.name") },
      { key: "connectionType", label: t("settings.f.connectionType"), render: (r) => cap(r.connectionType), csv: (r) => r.connectionType },
      { key: "capabilityProfile", label: t("settings.f.capabilityProfile") },
      { key: "charPerLine", label: t("settings.f.charPerLine"), align: "right" },
    ],
    fields: [
      f(t, "name", "text", { required: true }),
      f(t, "connectionType", "select", { initial: "network", half: true, options: () => (["network", "windows", "linux"] as const).map((v) => ({ value: v, label: cap(v) })) }),
      f(t, "capabilityProfile", "select", { initial: "default", half: true, options: () => (["default", "simple", "SP2000", "TEP-200M", "P822D"] as const).map((v) => ({ value: v, label: cap(v) })) }),
      f(t, "charPerLine", "number", { initial: 42, min: 10, half: true }),
      f(t, "ip", "text", { half: true, show: (v) => v.connectionType === "network" }),
      f(t, "port", "text", { initial: "9100", half: true, show: (v) => v.connectionType === "network" }),
      f(t, "path", "text", { show: (v) => v.connectionType !== "network" }),
    ],
  };
  return <CrudPage cfg={cfg} />;
}

export function BarcodesPage() {
  const t = useTranslations();
  const n = (key: string, extra: Partial<FieldDef> = {}) => f(t, key, "number", { min: 0, half: true, ...extra });
  const cfg: CrudConfig<"barcodeSettings"> = {
    table: "barcodeSettings", permission: "settings.barcode", title: t("nav.barcodeSettings"), description: t("settings.barcodesDescription"), icon: BarcodeIcon,
    addLabel: t("settings.addBarcode"), editLabel: t("settings.editBarcode"), emptyTitle: t("settings.noBarcodes"),
    columns: [
      { key: "name", label: t("settings.f.name"), render: (r) => <span className="font-medium">{r.name}{r.isDefault && <Badge className="ms-2" variant="secondary">{t("settings.default")}</Badge>}</span>, csv: (r) => r.name },
      { key: "description", label: t("settings.f.description") },
      { key: "paperWidth", label: t("settings.f.paperWidth"), align: "right" },
      { key: "perRow", label: t("settings.f.perRow"), align: "right" },
    ],
    fields: [
      f(t, "name", "text", { required: true }),
      f(t, "description", "textarea"),
      f(t, "isContinuous", "switch"),
      n("paperWidth", { required: true, initial: 8.5 }), n("paperHeight", { nullable: true, show: (v) => !v.isContinuous }),
      n("labelWidth", { required: true, initial: 2.5 }), n("labelHeight", { required: true, initial: 1.25 }),
      n("topMargin", { initial: 0 }), n("leftMargin", { initial: 0 }), n("rowDistance", { initial: 0 }), n("colDistance", { initial: 0 }),
      n("perRow", { required: true, min: 1, initial: 3 }), n("perSheet", { nullable: true, show: (v) => !v.isContinuous }),
      f(t, "isDefault", "switch"),
    ],
    canDelete: (r) => !r.isDefault,
  };
  return <CrudPage cfg={cfg} />;
}

function SchemesTable() {
  const t = useTranslations();
  const cfg: CrudConfig<"invoiceSchemes"> = {
    table: "invoiceSchemes", permission: "settings.invoice", embedded: true, title: t("settings.schemes"), description: "", icon: ReceiptIcon,
    addLabel: t("settings.addScheme"), editLabel: t("settings.editScheme"), emptyTitle: t("settings.noSchemes"),
    columns: [
      { key: "name", label: t("settings.f.name"), render: (r) => <span className="font-medium">{r.name}{r.isDefault && <Badge className="ms-2" variant="secondary">{t("settings.default")}</Badge>}</span>, csv: (r) => r.name },
      { key: "prefix", label: t("settings.f.prefix") },
      { key: "numberingType", label: t("settings.f.numberingType"), render: (r) => cap(r.numberingType), csv: (r) => r.numberingType },
      { key: "digits", label: t("settings.f.digits"), align: "right" },
      { key: "count", label: t("settings.f.count"), align: "right" },
    ],
    fields: [
      f(t, "name", "text", { required: true }),
      f(t, "prefix", "text", { half: true }),
      f(t, "numberingType", "select", { initial: "sequential", half: true, options: () => (["sequential", "random"] as const).map((v) => ({ value: v, label: cap(v) })) }),
      f(t, "startFrom", "number", { initial: 1, min: 0, half: true }),
      f(t, "digits", "number", { initial: 4, min: 1, half: true }),
      f(t, "isDefault", "switch"),
    ],
    defaults: { count: 0 },
    canDelete: (r) => !r.isDefault,
  };
  return <CrudPage cfg={cfg} />;
}

const FLAGS = [
  "showLogo", "showBusinessName", "showLocationName", "showMobile", "showAddress", "showEmail", "showTax1", "showCustomer", "showBarcode",
  "showQrCode", "showPaymentInfo", "showPreviousDue", "showBrand", "showSku", "showWarranty", "showSignature",
];

function LayoutsTable() {
  const t = useTranslations();
  const cfg: CrudConfig<"invoiceLayouts"> = {
    table: "invoiceLayouts", permission: "settings.invoice", embedded: true, title: t("settings.layouts"), description: "", icon: FileTextIcon,
    addLabel: t("settings.addLayout"), editLabel: t("settings.editLayout"), emptyTitle: t("settings.noLayouts"),
    columns: [
      { key: "name", label: t("settings.f.name"), render: (r) => <span className="font-medium">{r.name}{r.isDefault && <Badge className="ms-2" variant="secondary">{t("settings.default")}</Badge>}</span>, csv: (r) => r.name },
      { key: "design", label: t("settings.f.design"), render: (r) => cap(r.design), csv: (r) => r.design },
      { key: "paper", label: t("settings.f.paper") },
    ],
    fields: [
      f(t, "name", "text", { required: true }),
      f(t, "design", "select", { initial: "classic", half: true, options: () => (["classic", "elegant", "detailed", "columnize", "slim", "a4"] as const).map((v) => ({ value: v, label: cap(v) })) }),
      f(t, "paper", "select", { initial: "80mm", half: true, options: () => (["80mm", "58mm", "a4", "a5"] as const).map((v) => ({ value: v, label: cap(v) })) }),
      f(t, "headerText", "textarea"),
      f(t, "footerText", "textarea"),
      ...FLAGS.map((k) => ({ ...f(t, k, "switch"), half: true, initial: ["showLogo", "showBusinessName", "showLocationName", "showMobile", "showAddress", "showCustomer", "showPaymentInfo", "showSku"].includes(k) })),
      f(t, "isDefault", "switch"),
    ],
    defaults: { labels: {} },
    canDelete: (r) => !r.isDefault,
    preview: (v) => <LayoutPreview values={v} />,
  };
  return <CrudPage cfg={cfg} />;
}

export function InvoicesPage() {
  const t = useTranslations();
  return (
    <>
      <PageHeader title={t("nav.invoiceSettings")} description={t("settings.invoicesDescription")} />
      <Tabs defaultValue="schemes">
        <TabsList className="mb-4">
          <TabsTrigger value="schemes">{t("settings.schemes")}</TabsTrigger>
          <TabsTrigger value="layouts">{t("settings.layouts")}</TabsTrigger>
        </TabsList>
        <TabsContent value="schemes"><SchemesTable /></TabsContent>
        <TabsContent value="layouts"><LayoutsTable /></TabsContent>
      </Tabs>
    </>
  );
}

export function LocationsPage() {
  const t = useTranslations();
  const { data } = useLookups();
  const opts = <K extends "invoiceSchemes" | "invoiceLayouts" | "priceGroups">(k: K) => () => (data?.[k] ?? []).map((x) => ({ value: x.id, label: x.name }));
  const cfg: CrudConfig<"locations"> = {
    table: "locations", permission: "settings.location", title: t("nav.locations"), description: t("settings.locationsDescription"), icon: BuildingIcon,
    addLabel: t("settings.addLocation"), editLabel: t("settings.editLocation"), emptyTitle: t("settings.noLocations"),
    columns: [
      { key: "name", label: t("settings.f.name") },
      { key: "code", label: t("settings.f.code") },
      { key: "landmark", label: t("settings.f.landmark") },
      { key: "city", label: t("settings.f.city"), render: (r) => r.address.city, csv: (r) => r.address.city },
      { key: "zip", label: t("settings.f.zip"), render: (r) => r.address.zip, csv: (r) => r.address.zip },
      { key: "state", label: t("settings.f.state"), render: (r) => r.address.state, csv: (r) => r.address.state },
      { key: "country", label: t("settings.f.country"), render: (r) => r.address.country, csv: (r) => r.address.country },
      { key: "priceGroupId", label: t("settings.f.priceGroup"), render: (r) => data?.priceGroups.find((g) => g.id === r.priceGroupId)?.name ?? "—", csv: (r) => r.priceGroupId },
      { key: "invoiceSchemeId", label: t("settings.f.invoiceScheme"), render: (r) => data?.invoiceSchemes.find((g) => g.id === r.invoiceSchemeId)?.name ?? "—", csv: (r) => r.invoiceSchemeId },
      { key: "posLayoutId", label: t("settings.f.posLayout"), render: (r) => data?.invoiceLayouts.find((g) => g.id === r.posLayoutId)?.name ?? "—", csv: (r) => r.posLayoutId },
      { key: "saleLayoutId", label: t("settings.f.saleLayout"), render: (r) => data?.invoiceLayouts.find((g) => g.id === r.saleLayoutId)?.name ?? "—", csv: (r) => r.saleLayoutId },
      { key: "active", label: t("common.status"), render: (r) => activeBadge(t, r.active), csv: (r) => (r.active ? "active" : "inactive") },
    ],
    fields: [
      f(t, "name", "text", { required: true }),
      f(t, "landmark", "text", { half: true }), f(t, "mobile", "text", { half: true }),
      f(t, "email", "text", { half: true }), f(t, "website", "text", { half: true }),
      f(t, "priceGroupId", "select", { nullable: true, half: true, options: opts("priceGroups") }),
      f(t, "invoiceSchemeId", "select", { half: true, options: opts("invoiceSchemes") }),
      f(t, "posLayoutId", "select", { half: true, options: opts("invoiceLayouts") }),
      f(t, "saleLayoutId", "select", { half: true, options: opts("invoiceLayouts") }),
      f(t, "paymentMethods", "multi", { initial: [...PAYMENT_METHODS], options: () => PAYMENT_METHODS.map((m) => ({ value: m, label: t(`payMethods.${m}`) })) }),
      f(t, "featuredProductIds", "multi", { show: () => false }),
      f(t, "active", "switch", { initial: true }),
    ],
  };
  return <CrudPage cfg={cfg} />;
}

export function UsersPage() {
  const t = useTranslations();
  const { data } = useLookups();
  const cfg: CrudConfig<"users"> = {
    table: "users", permission: crudPerm("user"), title: t("nav.users"), description: t("settings.usersDescription"), icon: UsersIcon,
    addLabel: t("settings.addUser"), editLabel: t("settings.editUser"), emptyTitle: t("settings.noUsers"),
    columns: [
      { key: "username", label: t("settings.f.username") },
      { key: "firstName", label: t("settings.f.name"), render: (r) => `${r.firstName} ${r.lastName}`.trim(), csv: (r) => `${r.firstName} ${r.lastName}`.trim() },
      { key: "email", label: t("settings.f.email") },
      { key: "roleId", label: t("settings.f.role"), render: (r) => data?.roles.find((x) => x.id === r.roleId)?.name ?? "—", csv: (r) => data?.roles.find((x) => x.id === r.roleId)?.name },
      { key: "isActive", label: t("common.status"), render: (r) => activeBadge(t, r.isActive), csv: (r) => (r.isActive ? "active" : "inactive") },
    ],
    fields: [
      f(t, "firstName", "text", { required: true, half: true }), f(t, "lastName", "text", { half: true }),
      f(t, "username", "text", { required: true, half: true }), f(t, "email", "text", { half: true }),
      { ...f(t, "password", "password", { half: true, required: false }), label: t("settings.f.passwordNew") },
      f(t, "roleId", "select", { half: true, options: () => (data?.roles ?? []).map((r) => ({ value: r.id, label: r.name })) }),
      f(t, "locationIds", "multi", { options: () => (data?.locations ?? []).map((l) => ({ value: l.id, label: l.name })) }),
      f(t, "modules", "multi", { options: () => MODULE_OPTIONS.map((m) => ({ value: m, label: t(`nav.${m === "sales" ? "allSales" : m}`) })) }),
      f(t, "isSalesAgent", "switch"),
      f(t, "commissionPercent", "number", { min: 0, initial: 0, half: true, show: (v) => !!v.isSalesAgent }),
      f(t, "isActive", "switch", { initial: true }),
      f(t, "allowLogin", "switch", { initial: true }),
    ],
    defaults: { prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {} },
  };
  return <CrudPage cfg={cfg} />;
}
