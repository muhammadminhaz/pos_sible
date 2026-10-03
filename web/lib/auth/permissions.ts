/** Every permission a role can be granted. Grouped the way the Roles screen lists them. */
export const PERMISSIONS = [
  "dashboard.view",
  "contacts.supplier", "supplier.create", "supplier.update", "supplier.delete",
  "contacts.customer", "customer.create", "customer.update", "customer.delete", "contacts.import", "customer_group.view", "technician.view",
  "product.view", "product.create", "product.update", "product.delete", "product.opening_stock",
  "catalog.create", "catalog.update", "catalog.delete",
  "purchase.view", "purchase.create", "purchase.update", "purchase.delete", "purchase.payments", "purchase_return.view",
  "sell.view", "sell.create", "sell.update", "sell.delete", "sell.payments", "sell_return.view", "sales_order.view",
  "draft.view", "quotation.view", "shipment.view", "discount.view", "discount.create", "discount.update", "discount.delete", "sell.import",
  "pos.access", "pos.edit_price", "pos.edit_discount", "cash_register.close",
  "stock_transfer.view", "stock_transfer.create", "stock_transfer.update", "stock_transfer.delete",
  "stock_adjustment.view", "stock_adjustment.create", "stock_adjustment.delete",
  "expense.view", "expense.create", "expense.update", "expense.delete",
  "account.view", "account.create", "account.update", "account.manage",
  "report.view", "report.profit_loss", "report.stock",
  "settings.business", "settings.location", "settings.invoice", "settings.barcode", "settings.printer", "settings.tax",
  "user.view", "user.create", "user.update", "user.delete", "role.view", "role.create", "role.update", "role.delete",
  "backup", "modules", "calendar.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** `*` grants everything; an ungated check (`p` undefined) always passes. */
export function hasPermission(role: { permissions: string[] } | null | undefined, p?: string): boolean {
  if (!p) return true;
  if (!role) return false;
  return role.permissions.includes("*") || role.permissions.includes(p);
}

/** The permission list changes over time; a role stores which one it was written against. */
export const PERM_VERSION = 2;

/**
 * Version 2 split "can change this" into create / update / delete. A role saved before that keeps exactly what it
 * could do: each old permission grants the finer ones it used to cover. Idempotent, and never removes anything.
 */
const UPGRADES: Record<string, string[]> = {
  "contacts.customer": ["customer.create", "customer.update", "customer.delete"],
  "contacts.supplier": ["supplier.create", "supplier.update", "supplier.delete"],
  "product.update": ["catalog.create", "catalog.update", "catalog.delete"],
  "account.manage": ["account.create", "account.update"],
  "discount.manage": ["discount.create", "discount.update", "discount.delete"],
  "stock_transfer.create": ["stock_transfer.update", "stock_transfer.delete"],
  "stock_adjustment.create": ["stock_adjustment.delete"],
  "user.create": ["user.update", "user.delete"],
  "role.create": ["role.update", "role.delete"],
};

export function upgradeRole<R extends { permissions: string[]; permVersion?: number }>(role: R): R {
  if ((role.permVersion ?? 1) >= PERM_VERSION) return role;
  const next = new Set(role.permissions);
  for (const p of role.permissions) for (const q of UPGRADES[p] ?? []) next.add(q);
  next.delete("discount.manage");
  return { ...role, permissions: [...next], permVersion: PERM_VERSION };
}

export const upgradeRoles = <R extends { permissions: string[]; permVersion?: number }>(roles: R[]): R[] => roles.map(upgradeRole);

export type CrudAction = "create" | "update" | "delete";

/** The create / update / delete permissions of one area: "customer" → customer.create, customer.update, customer.delete. */
export const crudPerm = (prefix: string): Record<CrudAction, string> => ({
  create: `${prefix}.create`, update: `${prefix}.update`, delete: `${prefix}.delete`,
});

/** One permission for every write, or one per action. */
export type WritePermission = string | Record<CrudAction, string>;
export const permissionFor = (p: WritePermission, action: CrudAction): string => (typeof p === "string" ? p : p[action]);

/**
 * How the Roles screen lays permissions out: one row per part of the app, with the View / Create / Update / Delete
 * switches in columns, and anything that doesn't fit those four listed as extras.
 */
export type PermissionModule = {
  id: string;
  view?: Permission; create?: Permission; update?: Permission; delete?: Permission;
  extras?: Permission[];
};

export const PERMISSION_MODULES: PermissionModule[] = [
  { id: "dashboard", view: "dashboard.view" },
  { id: "customers", view: "contacts.customer", create: "customer.create", update: "customer.update", delete: "customer.delete", extras: ["customer_group.view", "technician.view"] },
  { id: "suppliers", view: "contacts.supplier", create: "supplier.create", update: "supplier.update", delete: "supplier.delete" },
  { id: "products", view: "product.view", create: "product.create", update: "product.update", delete: "product.delete", extras: ["product.opening_stock"] },
  { id: "catalog", create: "catalog.create", update: "catalog.update", delete: "catalog.delete" },
  { id: "purchases", view: "purchase.view", create: "purchase.create", update: "purchase.update", delete: "purchase.delete", extras: ["purchase.payments", "purchase_return.view"] },
  { id: "sales", view: "sell.view", create: "sell.create", update: "sell.update", delete: "sell.delete", extras: ["sell.payments", "sell_return.view", "sales_order.view", "draft.view", "quotation.view", "shipment.view", "sell.import"] },
  { id: "discounts", view: "discount.view", create: "discount.create", update: "discount.update", delete: "discount.delete" },
  { id: "pos", extras: ["pos.access", "pos.edit_price", "pos.edit_discount", "cash_register.close"] },
  { id: "transfers", view: "stock_transfer.view", create: "stock_transfer.create", update: "stock_transfer.update", delete: "stock_transfer.delete" },
  { id: "adjustments", view: "stock_adjustment.view", create: "stock_adjustment.create", delete: "stock_adjustment.delete" },
  { id: "expenses", view: "expense.view", create: "expense.create", update: "expense.update", delete: "expense.delete" },
  { id: "accounts", view: "account.view", create: "account.create", update: "account.update", extras: ["account.manage"] },
  { id: "reports", view: "report.view", extras: ["report.profit_loss", "report.stock"] },
  { id: "settings", extras: ["settings.business", "settings.location", "settings.invoice", "settings.barcode", "settings.printer", "settings.tax"] },
  { id: "users", view: "user.view", create: "user.create", update: "user.update", delete: "user.delete" },
  { id: "roles", view: "role.view", create: "role.create", update: "role.update", delete: "role.delete" },
  { id: "system", extras: ["backup", "modules", "calendar.view", "contacts.import"] },
];

export const modulePermissions = (m: PermissionModule): Permission[] =>
  [m.view, m.create, m.update, m.delete, ...(m.extras ?? [])].filter((p): p is Permission => !!p);
