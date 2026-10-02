export type ModuleKey = "catalog" | "pos" | "sales" | "operations" | "finance" | "reports" | "admin";

export type RouteMeta = { title: string; module: ModuleKey; permission?: string };

/**
 * Every screen in spec §3.3, keyed by its route pattern. `title` is a `nav.*` message key and
 * `module` names the sub-project that builds it (shown on the placeholder until then).
 */
export const ROUTES = {
  "/calendar": { title: "calendar", module: "reports", permission: "calendar.view" },
  "/profile": { title: "profile", module: "admin" },

  "/contacts/suppliers": { title: "suppliers", module: "operations", permission: "contacts.supplier" },
  "/contacts/customers": { title: "customers", module: "operations", permission: "contacts.customer" },
  "/contacts/customer-groups": { title: "customerGroups", module: "operations", permission: "customer_group.view" },
  "/contacts/technicians": { title: "technicians", module: "operations", permission: "technician.view" },
  "/contacts/import": { title: "importContacts", module: "operations", permission: "contacts.import" },

  "/products": { title: "listProducts", module: "catalog", permission: "product.view" },
  "/products/new": { title: "addProduct", module: "catalog", permission: "product.create" },
  "/products/[id]": { title: "productDetail", module: "catalog", permission: "product.view" },
  "/products/[id]/edit": { title: "editProduct", module: "catalog", permission: "product.update" },
  "/products/update-price": { title: "updatePrice", module: "catalog", permission: "product.update" },
  "/products/labels": { title: "printLabels", module: "catalog", permission: "product.view" },
  "/products/variations": { title: "variations", module: "catalog", permission: "product.create" },
  "/products/import": { title: "importProducts", module: "catalog", permission: "product.create" },
  "/products/import-opening-stock": { title: "importOpeningStock", module: "catalog", permission: "product.opening_stock" },
  "/products/price-groups": { title: "priceGroups", module: "catalog", permission: "product.create" },
  "/products/units": { title: "units", module: "catalog", permission: "product.create" },
  "/products/categories": { title: "categories", module: "catalog", permission: "product.create" },
  "/products/brands": { title: "brands", module: "catalog", permission: "product.create" },
  "/products/warranties": { title: "warranties", module: "catalog", permission: "product.create" },

  "/purchases": { title: "listPurchases", module: "operations", permission: "purchase.view" },
  "/purchases/new": { title: "addPurchase", module: "operations", permission: "purchase.create" },
  "/purchases/[id]": { title: "purchaseDetail", module: "operations", permission: "purchase.view" },
  "/purchases/[id]/edit": { title: "editPurchase", module: "operations", permission: "purchase.update" },
  "/purchases/returns": { title: "purchaseReturns", module: "operations", permission: "purchase_return.view" },
  "/purchases/returns/new": { title: "addPurchaseReturn", module: "operations", permission: "purchase_return.view" },

  "/sales": { title: "allSales", module: "sales", permission: "sell.view" },
  "/sales/new": { title: "addSale", module: "sales", permission: "sell.create" },
  "/sales/[id]": { title: "saleDetail", module: "sales", permission: "sell.view" },
  "/sales/[id]/edit": { title: "editSale", module: "sales", permission: "sell.update" },
  "/sales/orders": { title: "salesOrders", module: "sales", permission: "sales_order.view" },
  "/sales/drafts": { title: "drafts", module: "sales", permission: "draft.view" },
  "/sales/quotations": { title: "quotations", module: "sales", permission: "quotation.view" },
  "/sales/returns": { title: "sellReturns", module: "sales", permission: "sell_return.view" },
  "/sales/returns/new": { title: "addSellReturn", module: "sales", permission: "sell_return.view" },
  "/sales/shipments": { title: "shipments", module: "sales", permission: "shipment.view" },
  "/sales/discounts": { title: "discounts", module: "sales", permission: "discount.view" },
  "/sales/import": { title: "importSales", module: "sales", permission: "sell.import" },

  "/stock/transfers": { title: "stockTransfers", module: "operations", permission: "stock_transfer.view" },
  "/stock/transfers/new": { title: "addStockTransfer", module: "operations", permission: "stock_transfer.create" },
  "/stock/transfers/[id]": { title: "transferDetail", module: "operations", permission: "stock_transfer.view" },
  "/stock/adjustments": { title: "stockAdjustments", module: "operations", permission: "stock_adjustment.view" },
  "/stock/adjustments/new": { title: "addStockAdjustment", module: "operations", permission: "stock_adjustment.create" },

  "/expenses": { title: "listExpenses", module: "finance", permission: "expense.view" },
  "/expenses/new": { title: "addExpense", module: "finance", permission: "expense.create" },
  "/expenses/[id]/edit": { title: "editExpense", module: "finance", permission: "expense.update" },
  "/expenses/categories": { title: "expenseCategories", module: "finance", permission: "expense.view" },

  "/accounts": { title: "listAccounts", module: "finance", permission: "account.view" },
  "/accounts/[id]": { title: "accountDetail", module: "finance", permission: "account.view" },
  "/accounts/balance-sheet": { title: "balanceSheet", module: "finance", permission: "account.view" },
  "/accounts/trial-balance": { title: "trialBalance", module: "finance", permission: "account.view" },
  "/accounts/cash-flow": { title: "cashFlow", module: "finance", permission: "account.view" },
  "/accounts/payment-report": { title: "paymentAccountReport", module: "finance", permission: "account.view" },

  "/reports/profit-loss": { title: "profitLoss", module: "reports", permission: "report.profit_loss" },
  "/reports/purchase-sale": { title: "purchaseSale", module: "reports", permission: "report.view" },
  "/reports/tax": { title: "taxReport", module: "reports", permission: "report.view" },
  "/reports/contacts": { title: "contactsReport", module: "reports", permission: "report.view" },
  "/reports/customer-groups": { title: "customerGroupsReport", module: "reports", permission: "report.view" },
  "/reports/stock": { title: "stockReport", module: "reports", permission: "report.stock" },
  "/reports/stock-expiry": { title: "stockExpiry", module: "reports", permission: "report.stock" },
  "/reports/stock-adjustment": { title: "stockAdjustmentReport", module: "reports", permission: "report.stock" },
  "/reports/trending-products": { title: "trendingProducts", module: "reports", permission: "report.view" },
  "/reports/items": { title: "itemsReport", module: "reports", permission: "report.view" },
  "/reports/product-purchase": { title: "productPurchaseReport", module: "reports", permission: "report.view" },
  "/reports/product-sell": { title: "productSellReport", module: "reports", permission: "report.view" },
  "/reports/purchase-payment": { title: "purchasePaymentReport", module: "reports", permission: "report.view" },
  "/reports/sell-payment": { title: "sellPaymentReport", module: "reports", permission: "report.view" },
  "/reports/expense": { title: "expenseReport", module: "reports", permission: "report.view" },
  "/reports/register": { title: "registerReport", module: "reports", permission: "report.view" },
  "/reports/sales-representative": { title: "salesRepReport", module: "reports", permission: "report.view" },
  "/reports/table": { title: "tableReport", module: "reports", permission: "report.view" },

  "/settings/business": { title: "businessSettings", module: "admin", permission: "settings.business" },
  "/settings/locations": { title: "locations", module: "admin", permission: "settings.location" },
  "/settings/invoices": { title: "invoiceSettings", module: "admin", permission: "settings.invoice" },
  "/settings/barcodes": { title: "barcodeSettings", module: "admin", permission: "settings.barcode" },
  "/settings/printers": { title: "printers", module: "admin", permission: "settings.printer" },
  "/settings/tax-rates": { title: "taxRates", module: "admin", permission: "settings.tax" },
  "/settings/users": { title: "users", module: "admin", permission: "user.view" },
  "/settings/roles": { title: "roles", module: "admin", permission: "role.view" },
  "/settings/backup": { title: "backup", module: "admin", permission: "backup" },
  "/settings/modules": { title: "modules", module: "admin", permission: "modules" },
} satisfies Record<string, RouteMeta>;

export type RoutePattern = keyof typeof ROUTES;
