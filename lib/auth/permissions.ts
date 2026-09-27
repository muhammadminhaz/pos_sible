/** Every permission a role can be granted. Grouped the way the Roles screen lists them. */
export const PERMISSIONS = [
  "dashboard.view",
  "contacts.supplier", "contacts.customer", "contacts.import", "customer_group.view", "technician.view",
  "product.view", "product.create", "product.update", "product.delete", "product.opening_stock",
  "purchase.view", "purchase.create", "purchase.update", "purchase.delete", "purchase.payments", "purchase_return.view",
  "sell.view", "sell.create", "sell.update", "sell.delete", "sell.payments", "sell_return.view", "sales_order.view",
  "draft.view", "quotation.view", "shipment.view", "discount.view", "sell.import",
  "pos.access", "pos.edit_price", "pos.edit_discount", "cash_register.close",
  "stock_transfer.view", "stock_transfer.create", "stock_adjustment.view", "stock_adjustment.create",
  "expense.view", "expense.create", "expense.update", "expense.delete",
  "account.view", "account.manage",
  "report.view", "report.profit_loss", "report.stock",
  "settings.business", "settings.location", "settings.invoice", "settings.barcode", "settings.printer", "settings.tax",
  "user.view", "user.create", "role.view", "role.create",
  "backup", "modules", "calendar.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** `*` grants everything; an ungated check (`p` undefined) always passes. */
export function hasPermission(role: { permissions: string[] } | null | undefined, p?: string): boolean {
  if (!p) return true;
  if (!role) return false;
  return role.permissions.includes("*") || role.permissions.includes(p);
}
