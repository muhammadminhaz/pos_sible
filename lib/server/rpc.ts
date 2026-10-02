import "./passwords";
import "./context";
// Importing a service module registers it (see lib/data/api/facade.ts).
import "@/lib/data/services/accounts";
import "@/lib/data/services/adjustments";
import "@/lib/data/services/admin";
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
import "@/lib/data/services/reports/contacts";
import "@/lib/data/services/reports/dashboard";
import "@/lib/data/services/reports/money";
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
import { pool } from "./pool";
import { runInBusiness } from "./store";
import { TABLE_NAMES } from "./tables";

/**
 * Services whose every call exposes sensitive numbers need one of these permissions just to be called. The rest
 * (catalogue, contacts, sales ...) check the permission inside each write, exactly as they do in the browser.
 */
const GATES: Record<string, string[]> = {
  moneyReports: ["report.view", "report.profit_loss"],
  stockReports: ["report.view", "report.stock"],
  productReports: ["report.view"],
  contactReports: ["report.view"],
  activityReports: ["report.view"],
  ledgerReportsService: ["account.view", "report.view"],
  dashboardReports: ["dashboard.view"],
  dashboardService: ["dashboard.view"],
  profitService: ["dashboard.view", "report.view"],
  backupsService: ["backup"],
};

/** Things that are never callable from the network, whatever the service says. */
const BLOCKED = new Set(["constructor", "__proto__", "prototype"]);

export type RpcRequest = { service: unknown; method: unknown; args: unknown };
export type RpcResponse = { ok: true; result: unknown } | { ok: false; error: WireError };

function resolve(service: string, method: string): { target: Record<string, unknown>; fn: (...a: unknown[]) => unknown } {
  let target: Record<string, unknown> | undefined;
  if (service.startsWith("crud:")) {
    const table = service.slice(5);
    if (!(TABLE_NAMES as readonly string[]).includes(table)) throw new AppError("Unknown service", "not_found");
    target = serverCrud(table as (typeof TABLE_NAMES)[number]) as unknown as Record<string, unknown>;
  } else target = serviceRegistry.get(service);
  const fn = target && !BLOCKED.has(method) && Object.hasOwn(target, method) ? target[method] : undefined;
  if (typeof fn !== "function") throw new AppError("Unknown service call", "not_found");
  return { target: target!, fn: fn as (...a: unknown[]) => unknown };
}

/** Password hashes never leave the server. */
function redact(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null, (k, v) => (k === "password" && typeof v === "string" ? "" : v)));
}

export async function handleRpc(p: { businessId: string; userId: string; role: Role }, body: RpcRequest): Promise<RpcResponse> {
  const started = Date.now();
  try {
    if (typeof body.service !== "string" || typeof body.method !== "string" || !Array.isArray(body.args) || body.args.length > 20) {
      throw new AppError("Malformed request", "bad_request");
    }
    const { service, method, args } = body as { service: string; method: string; args: unknown[] };
    const gate = GATES[service];
    if (gate && !gate.some((g) => hasPermission(p.role, g))) throw new ForbiddenError(gate[0]);
    const { target, fn } = resolve(service, method);

    const out = await runInBusiness(p.businessId, p.userId, async () => fn.apply(target, args));
    if (out.wrote) {
      void pool()
        .query("INSERT INTO audit_log (business_id, user_id, service, method, changed_rows, duration_ms) VALUES ($1, $2, $3, $4, $5, $6)", [p.businessId, p.userId, service, method, out.changedRows, Date.now() - started])
        .catch(() => {});
    }
    return { ok: true, result: redact(out.result) };
  } catch (e) {
    if (e instanceof AppError || e instanceof ValidationError) return { ok: false, error: serializeError(e) };
    console.error("[rpc] unexpected error", e);
    return { ok: false, error: serializeError(e) };
  }
}
