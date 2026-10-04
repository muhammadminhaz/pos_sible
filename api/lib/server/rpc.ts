import "./passwords";
import "./context";
// Importing a service module registers it (see lib/data/api/facade.ts).
import "@/lib/data/services/accounts";
import "@/lib/data/services/adjustments";
import "@/lib/data/services/admin";
import "@/lib/data/services/calendar";
import "@/lib/data/services/contactImport";
import "@/lib/data/services/contacts";
import "@/lib/data/services/dashboard";
import "@/lib/data/services/discounts";
import "@/lib/data/services/expenses";
import "@/lib/data/services/ledgerReports";
import "@/lib/data/services/lookups";
import "@/lib/data/services/notifications";
import "@/lib/data/services/onboarding";
import "@/lib/data/services/orders";
import "@/lib/data/services/pos";
import "@/lib/data/services/priceSheet";
import "@/lib/data/services/productImport";
import "@/lib/data/services/products";
import "@/lib/data/services/purchaseImport";
import "@/lib/data/services/purchaseReturns";
import "@/lib/data/services/purchases";
import "@/lib/data/services/registers";
import "@/lib/data/services/reports/activity";
import "@/lib/data/services/reports/analytics";
import "@/lib/data/services/reports/contacts";
import "@/lib/data/services/reports/dashboard";
import "@/lib/data/services/reports/money";
import "@/lib/data/services/reports/growth";
import "@/lib/data/services/reports/products";
import "@/lib/data/services/reports/stock";
import "@/lib/data/services/returns";
import "@/lib/data/services/sales";
import "@/lib/data/services/salesImport";
import "@/lib/data/services/settings";
import "@/lib/data/services/transfers";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError, ForbiddenError, serializeError, ValidationError, type WireError } from "@/lib/data/errors";
import { serviceRegistry } from "@/lib/data/api/registry";
import { serverCrud } from "@/lib/data/services/catalog";
import type { Role } from "@/lib/data/schemas";
import { SERVICE_MODULES, type ModuleId } from "./plans";
import { pool } from "./pool";
import { loadBusiness, runInBusiness } from "./store";
import { TABLE_NAMES } from "./tables";

/**
 * Services whose every call exposes sensitive numbers need one of these permissions just to be called. The rest
 * (catalogue, contacts, sales ...) check the permission inside each write, exactly as they do in the browser.
 */
const GATES: Record<string, string[]> = {
  moneyReports: ["report.view", "report.profit_loss"],
  analyticsReports: ["report.view"],
  possibleReports: ["report.view"],
  goalsService: ["report.view"],
  stockReports: ["report.view", "report.stock"],
  productReports: ["report.view"],
  contactReports: ["report.view"],
  activityReports: ["report.view"],
  ledgerReportsService: ["account.view", "report.view"],
  dashboardReports: ["dashboard.view"],
  dashboardService: ["dashboard.view"],
  profitService: ["dashboard.view", "report.view"],
  backupsService: ["backup"],
  // Mirrors the permission each screen already requires, so hiding a menu item also closes the door behind it.
  purchasesService: ["purchase.view", "purchase.create", "purchase.update"],
  purchaseReturnsService: ["purchase_return.view", "purchase.view", "purchase.update"],
  purchaseImportService: ["purchase.create"],
  accountsService: ["account.view", "account.manage"],
  expensesService: ["expense.view", "expense.create", "expense.update"],
  transfersService: ["stock_transfer.view", "stock_transfer.create"],
  adjustmentsService: ["stock_adjustment.view", "stock_adjustment.create"],
  discountsService: ["discount.view", "discount.manage"],
  productsService: ["product.view", "product.create", "product.update"],
  priceSheetService: ["product.view", "product.update"],
  contactsService: ["contacts.customer", "contacts.supplier", "contacts.import"],
  contactImportService: ["contacts.import"],
  productImportService: ["product.create", "product.opening_stock", "product.update"],
  salesImportService: ["sell.import"],
  ordersService: ["sales_order.view", "sell.view", "sell.create"],
  returnsService: ["sell_return.view", "sell.update", "sell.create"],
  registersService: ["pos.access", "cash_register.close", "report.view"],
  posService: ["pos.access", "sell.create", "sell.view"],
  salesService: ["sell.view", "sell.create", "sell.update", "pos.access", "draft.view", "quotation.view", "sales_order.view", "shipment.view", "sell_return.view"],
  calendarService: ["calendar.view", "dashboard.view"],
};

/**
 * The generic CRUD endpoint reaches only the settings-style reference tables the screens edit. Transactions, stock,
 * contacts, products and backups have their own services with their own rules, and are not readable this way.
 */
const CRUD_TABLES = new Set([
  "accountTypes", "barcodeSettings", "brands", "categories", "customerGroups", "expenseCategories", "invoiceLayouts", "invoiceSchemes",
  "locations", "priceGroups", "printers", "roles", "taxRates", "technicians", "units", "users", "variationTemplates", "warranties",
]);

/** Things that are never callable from the network, whatever the service says. */
const BLOCKED = new Set(["constructor", "__proto__", "prototype"]);

export type RpcRequest = { service: unknown; method: unknown; args: unknown };
export type RpcResponse = { ok: true; result: unknown } | { ok: false; error: WireError };

function resolve(service: string, method: string): { target: Record<string, unknown>; fn: (...a: unknown[]) => unknown } {
  let target: Record<string, unknown> | undefined;
  if (service.startsWith("crud:")) {
    const table = service.slice(5);
    if (!CRUD_TABLES.has(table) || !(TABLE_NAMES as readonly string[]).includes(table)) throw new AppError("Unknown service", "not_found");
    target = serverCrud(table as (typeof TABLE_NAMES)[number]) as unknown as Record<string, unknown>;
  } else target = serviceRegistry.get(service);
  const fn = target && !BLOCKED.has(method) && Object.hasOwn(target, method) ? target[method] : undefined;
  if (typeof fn !== "function") throw new AppError("Unknown service call", "not_found");
  return { target: target!, fn: fn as (...a: unknown[]) => unknown };
}

/**
 * A package allows a number of users in total, whether or not they can sign in. Adding one is refused at the limit,
 * whatever the screen does; deactivating and deleting are never blocked.
 */
async function assertUserQuota(businessId: string, method: string): Promise<void> {
  if (method !== "create") return;
  const row = (await pool().query<{ max_users: number | null }>("SELECT CASE WHEN b.free THEN NULL ELSE p.max_users END AS max_users FROM businesses b JOIN plans p ON p.id = b.plan WHERE b.id = $1", [businessId])).rows[0];
  const max = row?.max_users ?? null;
  if (max === null) return;
  const { db } = await loadBusiness(businessId);
  if (db.users.length >= max) throw new AppError(`Your plan allows up to ${max} users. Ask your provider to upgrade the package.`, "plan_limit");
}

/** Password hashes never leave the server. */
function redact(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null, (k, v) => (k === "password" && typeof v === "string" ? "" : v)));
}

export async function handleRpc(p: { businessId: string; userId: string; role: Role; modules?: ModuleId[] }, body: RpcRequest): Promise<RpcResponse> {
  try {
    if (typeof body.service !== "string" || typeof body.method !== "string" || !Array.isArray(body.args) || body.args.length > 20) {
      throw new AppError("Malformed request", "bad_request");
    }
    const { service, method, args } = body as { service: string; method: string; args: unknown[] };
    // A module the business hasn't subscribed to is closed here, whatever the screens show.
    const unlockedBy = SERVICE_MODULES[service];
    if (p.modules && unlockedBy && !unlockedBy.some((m) => p.modules!.includes(m))) throw new AppError("This feature isn't part of your subscription.", "module_off");
    const gate = GATES[service];
    if (gate && !gate.some((g) => hasPermission(p.role, g))) throw new ForbiddenError(gate[0]);
    const { target, fn } = resolve(service, method);
    if (service === "crud:users") await assertUserQuota(p.businessId, method);

    const out = await runInBusiness(p.businessId, p.userId, async () => fn.apply(target, args), { service, method });
    return { ok: true, result: redact(out.result) };
  } catch (e) {
    if (e instanceof AppError || e instanceof ValidationError) return { ok: false, error: serializeError(e) };
    console.error("[rpc] unexpected error", e);
    return { ok: false, error: serializeError(e) };
  }
}
