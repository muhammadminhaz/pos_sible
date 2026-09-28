import {
  ArrowLeftRightIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  HomeIcon,
  LandmarkIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { key: string; href: string; icon?: LucideIcon; permission?: string; keywords?: string[] };
export type NavGroup = { key: string; icon: LucideIcon; href?: string; permission?: string; items?: NavItem[] };

/** The sidebar tree. Labels are `t(\`nav.${key}\`)`; hrefs match the route scaffold in spec §3.3. */
export const NAV: NavGroup[] = [
  { key: "home", icon: HomeIcon, href: "/home", permission: "dashboard.view" },
  {
    key: "contacts",
    icon: UsersIcon,
    items: [
      { key: "suppliers", href: "/contacts/suppliers", permission: "contacts.supplier", keywords: ["vendor"] },
      { key: "customers", href: "/contacts/customers", permission: "contacts.customer", keywords: ["client"] },
      { key: "customerGroups", href: "/contacts/customer-groups", permission: "customer_group.view" },
      { key: "technicians", href: "/contacts/technicians", permission: "technician.view" },
      { key: "importContacts", href: "/contacts/import", permission: "contacts.import", keywords: ["csv"] },
    ],
  },
  {
    key: "products",
    icon: PackageIcon,
    items: [
      { key: "listProducts", href: "/products", permission: "product.view", keywords: ["items", "inventory"] },
      { key: "addProduct", href: "/products/new", permission: "product.create" },
      { key: "updatePrice", href: "/products/update-price", permission: "product.update" },
      { key: "printLabels", href: "/products/labels", permission: "product.view", keywords: ["barcode"] },
      { key: "variations", href: "/products/variations", permission: "product.create" },
      { key: "importProducts", href: "/products/import", permission: "product.create", keywords: ["csv"] },
      { key: "importOpeningStock", href: "/products/import-opening-stock", permission: "product.opening_stock" },
      { key: "priceGroups", href: "/products/price-groups", permission: "product.create", keywords: ["wholesale"] },
      { key: "units", href: "/products/units", permission: "product.create" },
      { key: "categories", href: "/products/categories", permission: "product.create" },
      { key: "brands", href: "/products/brands", permission: "product.create" },
      { key: "warranties", href: "/products/warranties", permission: "product.create" },
    ],
  },
  {
    key: "purchases",
    icon: ShoppingBagIcon,
    items: [
      { key: "listPurchases", href: "/purchases", permission: "purchase.view" },
      { key: "addPurchase", href: "/purchases/new", permission: "purchase.create" },
      { key: "purchaseReturns", href: "/purchases/returns", permission: "purchase_return.view" },
    ],
  },
  {
    key: "sell",
    icon: ShoppingCartIcon,
    items: [
      { key: "salesOrders", href: "/sales/orders", permission: "sales_order.view" },
      { key: "allSales", href: "/sales", permission: "sell.view", keywords: ["invoices"] },
      { key: "addSale", href: "/sales/new", permission: "sell.create" },
      { key: "listPos", href: "/sales?channel=pos", permission: "sell.view" },
      { key: "pos", href: "/pos", permission: "pos.access", keywords: ["register", "checkout"] },
      { key: "addDraft", href: "/sales/new?status=draft", permission: "sell.create" },
      { key: "drafts", href: "/sales/drafts", permission: "draft.view" },
      { key: "addQuotation", href: "/sales/new?status=quotation", permission: "sell.create" },
      { key: "quotations", href: "/sales/quotations", permission: "quotation.view" },
      { key: "sellReturns", href: "/sales/returns", permission: "sell_return.view", keywords: ["refund"] },
      { key: "shipments", href: "/sales/shipments", permission: "shipment.view", keywords: ["delivery"] },
      { key: "discounts", href: "/sales/discounts", permission: "discount.view" },
      { key: "importSales", href: "/sales/import", permission: "sell.import" },
    ],
  },
  {
    key: "stock",
    icon: ArrowLeftRightIcon,
    items: [
      { key: "stockTransfers", href: "/stock/transfers", permission: "stock_transfer.view" },
      { key: "addStockTransfer", href: "/stock/transfers/new", permission: "stock_transfer.create" },
      { key: "stockAdjustments", href: "/stock/adjustments", permission: "stock_adjustment.view", keywords: ["damage"] },
      { key: "addStockAdjustment", href: "/stock/adjustments/new", permission: "stock_adjustment.create" },
    ],
  },
  {
    key: "expenses",
    icon: ReceiptIcon,
    items: [
      { key: "listExpenses", href: "/expenses", permission: "expense.view" },
      { key: "addExpense", href: "/expenses/new", permission: "expense.create" },
      { key: "expenseCategories", href: "/expenses/categories", permission: "expense.view" },
    ],
  },
  {
    key: "accounts",
    icon: LandmarkIcon,
    items: [
      { key: "listAccounts", href: "/accounts", permission: "account.view", keywords: ["bank", "bkash"] },
      { key: "balanceSheet", href: "/accounts/balance-sheet", permission: "account.view" },
      { key: "trialBalance", href: "/accounts/trial-balance", permission: "account.view" },
      { key: "cashFlow", href: "/accounts/cash-flow", permission: "account.view" },
      { key: "paymentAccountReport", href: "/accounts/payment-report", permission: "account.view" },
    ],
  },
  {
    key: "reports",
    icon: BarChart3Icon,
    items: [
      { key: "profitLoss", href: "/reports/profit-loss", permission: "report.view" },
      { key: "purchaseSale", href: "/reports/purchase-sale", permission: "report.view" },
      { key: "taxReport", href: "/reports/tax", permission: "report.view", keywords: ["vat"] },
      { key: "contactsReport", href: "/reports/contacts", permission: "report.view" },
      { key: "customerGroupsReport", href: "/reports/customer-groups", permission: "report.view" },
      { key: "stockReport", href: "/reports/stock", permission: "report.view" },
      { key: "stockExpiry", href: "/reports/stock-expiry", permission: "report.view" },
      { key: "stockAdjustmentReport", href: "/reports/stock-adjustment", permission: "report.view" },
      { key: "trendingProducts", href: "/reports/trending-products", permission: "report.view" },
      { key: "itemsReport", href: "/reports/items", permission: "report.view" },
      { key: "productPurchaseReport", href: "/reports/product-purchase", permission: "report.view" },
      { key: "productSellReport", href: "/reports/product-sell", permission: "report.view" },
      { key: "purchasePaymentReport", href: "/reports/purchase-payment", permission: "report.view" },
      { key: "sellPaymentReport", href: "/reports/sell-payment", permission: "report.view" },
      { key: "expenseReport", href: "/reports/expense", permission: "report.view" },
      { key: "registerReport", href: "/reports/register", permission: "report.view" },
      { key: "salesRepReport", href: "/reports/sales-representative", permission: "report.view", keywords: ["commission"] },
      { key: "tableReport", href: "/reports/table", permission: "report.view" },
    ],
  },
  {
    key: "settings",
    icon: SettingsIcon,
    items: [
      { key: "businessSettings", href: "/settings/business", permission: "settings.business" },
      { key: "locations", href: "/settings/locations", permission: "settings.location", keywords: ["branch", "shop"] },
      { key: "invoiceSettings", href: "/settings/invoices", permission: "settings.invoice" },
      { key: "barcodeSettings", href: "/settings/barcodes", permission: "settings.barcode" },
      { key: "printers", href: "/settings/printers", permission: "settings.printer" },
      { key: "taxRates", href: "/settings/tax-rates", permission: "settings.tax", keywords: ["vat"] },
      { key: "users", href: "/settings/users", permission: "user.view", keywords: ["staff"] },
      { key: "roles", href: "/settings/roles", permission: "role.view", keywords: ["permissions"] },
      { key: "backup", href: "/settings/backup", permission: "backup", keywords: ["export", "restore"] },
      { key: "modules", href: "/settings/modules", permission: "modules" },
    ],
  },
  { key: "calendar", icon: CalendarDaysIcon, href: "/calendar", permission: "calendar.view" },
];

const pathOf = (href: string) => href.split("?")[0];

/**
 * Finds the group and item for a URL. Prefers the longest matching href so `/products/new`
 * beats `/products`, and query-specific items (`/sales?channel=pos`) only match their query.
 */
export function findNavTrail(pathname: string, search = ""): { group?: NavGroup; item?: NavItem } {
  let best: { group?: NavGroup; item?: NavItem; score: number } = { score: -1 };
  const params = new URLSearchParams(search);
  for (const group of NAV) {
    const candidates: [NavItem | undefined, string][] = group.href
      ? [[undefined, group.href]]
      : (group.items ?? []).map((i) => [i, i.href]);
    for (const [item, href] of candidates) {
      const path = pathOf(href);
      if (pathname !== path && !pathname.startsWith(`${path}/`)) continue;
      const query = new URLSearchParams(href.split("?")[1] ?? "");
      const queryMatches = [...query].every(([k, v]) => params.get(k) === v);
      if (!queryMatches) continue;
      const score = path.length * 10 + (pathname === path ? 5 : 0) + query.size;
      if (score > best.score) best = { group, item, score };
    }
  }
  return { group: best.group, item: best.item };
}
