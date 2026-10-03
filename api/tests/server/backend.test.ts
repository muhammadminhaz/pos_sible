import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresAvailable } from "./helpers";

const up = await postgresAvailable();

describe.runIf(up)("Postgres backend", () => {
  let mod: typeof import("@/lib/server/rpc");
  let auth: typeof import("@/lib/server/auth");
  let tenants: typeof import("@/lib/server/tenants");
  let store: typeof import("@/lib/server/store");
  let poolMod: typeof import("@/lib/server/pool");
  let biz: string;
  let admin: { businessId: string; userId: string; role: import("@/lib/data/schemas").Role };
  const uname = `owner${Date.now().toString(36)}`;

  const call = async (p: typeof admin, service: string, method: string, ...args: unknown[]) => mod.handleRpc(p, { service, method, args });
  const ok = async (p: typeof admin, service: string, method: string, ...args: unknown[]) => {
    const r = await call(p, service, method, ...args);
    if (!r.ok) throw new Error(`${service}.${method} failed: ${JSON.stringify(r.error)}`);
    return r.result as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  beforeAll(async () => {
    mod = await import("@/lib/server/rpc");
    auth = await import("@/lib/server/auth");
    tenants = await import("@/lib/server/tenants");
    store = await import("@/lib/server/store");
    poolMod = await import("@/lib/server/pool");
    await poolMod.ready();
    const created = await tenants.createBusiness({ name: "Lotus Mart", admin: { username: uname, password: "correct horse", firstName: "Lila" } });
    biz = created.businessId;
    const principal = (await auth.login(uname, "correct horse", true, "t"))!;
    if (!principal.ok) throw new Error("login failed");
    admin = { businessId: biz, userId: principal.principal.userId, role: principal.principal.role };
  }, 60_000);

  afterAll(async () => {
    await poolMod.pool().query("DELETE FROM businesses WHERE id = $1", [biz]);
    await poolMod.pool().end();
  });

  it("signs in with the right password only, and never accepts a plain-text stored password", async () => {
    expect((await auth.login(uname, "wrong", true, "ip1")).ok).toBe(false);
    expect((await auth.login("nobody", "x", true, "ip1")).ok).toBe(false);
    const r = await auth.login(uname.toUpperCase(), "correct horse", false, "ip2");
    expect(r.ok && r.maxAge).toBe(null); // a session cookie when "remember me" is off
    const stored = (await poolMod.pool().query("SELECT data->>'password' AS p FROM users WHERE business_id = $1 AND id = 'user_admin'", [biz])).rows[0].p as string;
    expect(stored.startsWith("scrypt$")).toBe(true);
  });

  it("locks out after repeated wrong passwords", async () => {
    for (let i = 0; i < 5; i++) await auth.login(uname, "bad", true, "attacker");
    const r = await auth.login(uname, "correct horse", true, "attacker");
    expect(r).toMatchObject({ ok: false, reason: "throttled" });
  });

  it("serves service calls, hides password hashes and refuses unknown calls", async () => {
    const lookups = await ok(admin, "lookupsService", "all");
    expect(lookups.users.length).toBeGreaterThan(1);
    expect(lookups.users.every((u: { password: string }) => u.password === "")).toBe(true);
    expect(await call(admin, "lookupsService", "nope")).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(await call(admin, "salesService", "constructor")).toMatchObject({ ok: false });
    expect(await call(admin, "nonexistent", "x")).toMatchObject({ ok: false });
    expect(await call(admin, "crud:not_a_table", "list")).toMatchObject({ ok: false });
    // The generic table endpoint can't be used to read ledgers, stock, contacts or backups around their own services.
    for (const t of ["transactions", "stockLots", "contacts", "backups", "accountTxns", "products"]) {
      expect(await call(admin, `crud:${t}`, "all")).toMatchObject({ ok: false, error: { code: "not_found" } });
    }
  });

  it("saves changes in Postgres, and a failed call leaves nothing behind", async () => {
    const before = (await poolMod.pool().query("SELECT count(*)::int AS n FROM brands WHERE business_id = $1", [biz])).rows[0].n;
    await ok(admin, "crud:brands", "create", { name: "Daraz Tea", note: "" });
    const after = (await poolMod.pool().query("SELECT count(*)::int AS n FROM brands WHERE business_id = $1", [biz])).rows[0].n;
    expect(after).toBe(before + 1);

    const bad = await call(admin, "crud:users", "create", { username: uname, firstName: "Dup", roleId: "role_cashier", password: "abcdef", locationIds: [] });
    expect(bad).toMatchObject({ ok: false, error: { name: "ValidationError", fields: { username: "duplicate" } } });
    expect((await poolMod.pool().query("SELECT count(*)::int AS n FROM users WHERE business_id = $1 AND data->>'firstName' = 'Dup'", [biz])).rows[0].n).toBe(0);
  });

  it("hashes passwords of users created through the API and lets them sign in", async () => {
    const name = `cash${Date.now().toString(36)}`;
    await ok(admin, "crud:users", "create", { username: name, firstName: "Rina", lastName: "", email: "", roleId: "role_cashier", password: "secret-pass", locationIds: [], isActive: true, allowLogin: true, prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 });
    const stored = (await poolMod.pool().query("SELECT data->>'password' AS p FROM users WHERE business_id = $1 AND data->>'username' = $2", [biz, name])).rows[0].p as string;
    expect(stored.startsWith("scrypt$")).toBe(true);
    const r = await auth.login(name, "secret-pass", true, "ip3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const cashier = { businessId: biz, userId: r.principal.userId, role: r.principal.role };
      // A cashier can ring up a sale but not read the profit report or change settings.
      expect(await call(cashier, "moneyReports", "profitLoss", {})).toMatchObject({ ok: false, error: { name: "ForbiddenError" } });
      expect(await call(cashier, "settingsService", "update", "business", { name: "Hacked" })).toMatchObject({ ok: false, error: { name: "ForbiddenError" } });
      expect((await ok(admin, "settingsService", "get")).business.name).toBe("Lotus Mart");
      // Cost prices, supplier balances and account books are behind the same permissions as their menu items.
      for (const [svc, m] of [["purchasesService", "list"], ["accountsService", "list"], ["expensesService", "list"], ["transfersService", "list"], ["discountsService", "list"]] as const) {
        expect(await call(cashier, svc, m, {}), `${svc}.${m}`).toMatchObject({ ok: false, error: { name: "ForbiddenError" } });
      }
      // …while the till still works: customers, products and the register are available.
      expect((await call(cashier, "contactsService", "list", { type: "customer", pageSize: 5 })).ok).toBe(true);
      expect((await call(cashier, "lookupsService", "all")).ok).toBe(true);
    }
  });

  it("several people share one business, and every change records who made it", async () => {
    const mk = async (roleId: string, tag: string) => {
      const username = `${tag}${Date.now().toString(36)}`;
      await ok(admin, "crud:users", "create", { username, firstName: tag, lastName: "Shop", email: "", roleId, password: "pass-word1", locationIds: [], isActive: true, allowLogin: true, prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 });
      const r = await auth.login(username, "pass-word1", true, `ip-${tag}`);
      if (!r.ok) throw new Error("login failed");
      return { businessId: biz, userId: r.principal.userId, role: r.principal.role };
    };
    const manager = await mk("role_manager", "mgr");
    const cashier = await mk("role_cashier", "csh");

    // The admin creates a brand; the manager renames it; the stamps tell the two apart.
    const brand = await ok(admin, "crud:brands", "create", { name: "Acme", description: "" });
    expect(brand.createdBy).toBe(admin.userId);
    await ok(manager, "crud:brands", "update", brand.id, { name: "Acme Ltd" });
    const after = await ok(admin, "crud:brands", "get", brand.id);
    expect(after).toMatchObject({ createdBy: admin.userId, updatedBy: manager.userId });
    expect(after.updatedAt).toBeTruthy();

    // The manager may add and change, but this role was never given delete; a cashier gets none of it.
    expect(await call(manager, "crud:brands", "remove", brand.id)).toMatchObject({ ok: false, error: { name: "ForbiddenError" } });
    expect(await call(cashier, "crud:brands", "update", brand.id, { name: "Nope" })).toMatchObject({ ok: false, error: { name: "ForbiddenError" } });
    // And nobody can promote themselves.
    const mgrRole = (await ok(admin, "crud:roles", "all")).find((r: { id: string }) => r.id === "role_manager");
    expect(await call(manager, "crud:roles", "update", mgrRole.id, { permissions: ["*"] })).toMatchObject({ ok: false });
    expect((await ok(admin, "crud:brands", "get", brand.id)).name).toBe("Acme Ltd");
  });

  it("deactivating a user ends their session straight away", async () => {
    const name = `temp${Date.now().toString(36)}`;
    const created = await ok(admin, "crud:users", "create", { username: name, firstName: "Temp", lastName: "", email: "", roleId: "role_cashier", password: "temp-pass1", locationIds: [], isActive: true, allowLogin: true, prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 });
    const r = await auth.login(name, "temp-pass1", true, "ip4");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const req = { cookies: { get: () => ({ value: r.token }) } };
    expect(await auth.authenticate(req)).not.toBeNull();
    await ok(admin, "crud:users", "update", created.id, { isActive: false });
    expect(await auth.authenticate(req)).toBeNull();
  });

  it("a usable shop end to end: fresh start, import a product and stock, sell it, books balance", async () => {
    await ok(admin, "onboardingService", "complete", { mode: "fresh", businessName: "Lotus Mart", currencySymbol: "৳", currencyCode: "BDT", locationName: "Mirpur", phone: "01711", city: "Dhaka", themeColor: "green" });
    const loc = (await ok(admin, "lookupsService", "all")).locations[0];
    const parsed = await ok(admin, "productImportService", "parseProducts", "name,unit,purchase_exc,sell_exc\nTea 500g,Pieces,100,150");
    expect(parsed.errors).toEqual([]);
    await ok(admin, "productImportService", "commitProducts", parsed.rows, "p.csv");
    const sku = (await poolMod.pool().query("SELECT data->>'sku' AS sku FROM variations WHERE business_id = $1", [biz])).rows[0].sku;
    const stock = await ok(admin, "productImportService", "parseOpeningStock", `sku,location,qty,unit_cost\n${sku},${loc.name},20,100`);
    await ok(admin, "productImportService", "commitOpeningStock", stock.rows, "o.csv");
    await ok(admin, "registersService", "open", loc.id, 0);

    const products = await ok(admin, "posService", "products", { locationId: loc.id, pageSize: -1 });
    const p = products.rows[0];
    const { toCartItem } = await import("@/lib/data/services/pos");
    const { addItem, emptyCart } = await import("@/lib/pos/cart");
    const cart = addItem(emptyCart(), toCartItem(p, p.variations[0], 2), "new_row");
    const sale = await ok(admin, "salesService", "checkout", { cart, locationId: loc.id, status: "final", payments: [{ method: "cash", amount: 300 }] });
    expect(sale.total).toBe(300);

    // The same sale is visible to the next request, and the stock really went down.
    const left = (await poolMod.pool().query("SELECT sum((data->>'qtyRemaining')::numeric) AS q FROM stock_lots WHERE business_id = $1", [biz])).rows[0].q;
    expect(Number(left)).toBe(18);
    const tb = await ok(admin, "ledgerReportsService", "trialBalance", {});
    expect(tb.debit).toBeCloseTo(tb.credit, 2);
    expect((await poolMod.pool().query("SELECT count(*)::int AS n FROM audit_log WHERE business_id = $1 AND method = 'checkout'", [biz])).rows[0].n).toBe(1);
  }, 60_000);

  it("two sales at the same moment both land, with different invoice numbers and consistent stock", async () => {
    const loc = (await ok(admin, "lookupsService", "all")).locations[0];
    const products = await ok(admin, "posService", "products", { locationId: loc.id, pageSize: -1 });
    const p = products.rows[0];
    const { toCartItem } = await import("@/lib/data/services/pos");
    const { addItem, emptyCart } = await import("@/lib/pos/cart");
    const mk = () => addItem(emptyCart(), toCartItem(p, p.variations[0], 1), "new_row");
    const results = await Promise.all(Array.from({ length: 6 }, () => call(admin, "salesService", "checkout", { cart: mk(), locationId: loc.id, status: "final", payments: [{ method: "cash", amount: 150 }] })));
    expect(results.every((r) => r.ok)).toBe(true);
    const refs = results.map((r) => (r as { result: { refNo: string } }).result.refNo);
    expect(new Set(refs).size).toBe(6);
    const left = (await poolMod.pool().query("SELECT sum((data->>'qtyRemaining')::numeric) AS q FROM stock_lots WHERE business_id = $1", [biz])).rows[0].q;
    expect(Number(left)).toBe(12);
  }, 60_000);

  it("one business can't see another's data or reuse its usernames", async () => {
    const other = await tenants.createBusiness({ name: "Other Co", admin: { username: `other${Date.now().toString(36)}`, password: "other pass 1", firstName: "Omar" } });
    try {
      await expect(tenants.createBusiness({ name: "Clash", admin: { username: uname, password: "whatever12", firstName: "X" } })).rejects.toBeTruthy();
      const r = await auth.login((await poolMod.pool().query("SELECT username FROM logins WHERE business_id = $1 AND user_id = 'user_admin'", [other.businessId])).rows[0].username, "other pass 1", true, "ip9");
      expect(r.ok).toBe(true);
      if (r.ok) {
        const o = { businessId: other.businessId, userId: r.principal.userId, role: r.principal.role };
        const settings = await ok(o, "settingsService", "get");
        expect(settings.business.name).toBe("Other Co");
        expect((await ok(o, "contactsService", "list", { pageSize: -1 })).rows.every((c: { name: string }) => c.name !== "Tea 500g")).toBe(true);
      }
    } finally {
      await poolMod.pool().query("DELETE FROM businesses WHERE id = $1", [other.businessId]);
      store.forgetBusiness(other.businessId);
    }
  }, 60_000);
});
