import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { postgresAvailable } from "./helpers";

const up = await postgresAvailable();

describe.runIf(up)("platform admin and subscriptions", () => {
  let platform: typeof import("@/lib/server/platform");
  let auth: typeof import("@/lib/server/auth");
  let rpc: typeof import("@/lib/server/rpc");
  let poolMod: typeof import("@/lib/server/pool");
  let list: typeof import("@/app/api/admin/businesses/route");
  let patchRoute: typeof import("@/app/api/admin/businesses/[id]/route");
  let adminToken: string;
  const ids: string[] = [];
  const tag = Date.now().toString(36);

  const asAdmin = (url: string, init: { method?: string; body?: string } = {}) =>
    new NextRequest(`http://localhost:3000${url}`, { ...init, headers: { cookie: `posible_admin=${adminToken}`, "content-type": "application/json" } });

  const open = async (name: string, username: string, plan = "starter", expiresAt: string | null = null) => {
    const res = await list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: name, username, password: "owner-pass-1", plan, expiresAt }) }));
    expect(res.status).toBe(201);
    const id = (await res.json()).id as string;
    ids.push(id);
    return id;
  };
  const summary = async (id: string) => {
    const body = await (await list.GET(asAdmin("/api/admin/businesses"))).json();
    return body.businesses.find((b: { id: string }) => b.id === id);
  };
  const principal = async (username: string) => {
    const r = await auth.login(username, "owner-pass-1", true, `ip-${username}`);
    if (!r.ok) throw new Error(`login failed: ${r.reason}`);
    return { cookie: r.token, p: { businessId: r.principal.businessId, userId: r.principal.userId, role: r.principal.role, modules: r.principal.modules } };
  };

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = "owner-admin";
    process.env.ADMIN_PASSWORD = "platform-secret";
    platform = await import("@/lib/server/platform");
    auth = await import("@/lib/server/auth");
    rpc = await import("@/lib/server/rpc");
    poolMod = await import("@/lib/server/pool");
    list = await import("@/app/api/admin/businesses/route");
    patchRoute = await import("@/app/api/admin/businesses/[id]/route");
    await poolMod.ready();
    const r = await platform.adminLogin("owner-admin", "platform-secret", "ip-admin");
    if (!r.ok) throw new Error("admin login failed");
    adminToken = r.token;
  }, 60_000);

  afterAll(async () => {
    for (const id of ids) await poolMod.pool().query("DELETE FROM businesses WHERE id = $1", [id]);
    await poolMod.pool().end();
  });

  it("signs in with the configured credentials only, and throttles guessing", async () => {
    expect((await platform.adminLogin("owner-admin", "nope", "ip-x")).ok).toBe(false);
    expect((await platform.adminLogin("someone", "platform-secret", "ip-x")).ok).toBe(false);
    expect((await platform.adminLogin("OWNER-ADMIN ", "platform-secret", "ip-y")).ok).toBe(false); // exact password, but not the exact name
    for (let i = 0; i < 5; i++) await platform.adminLogin("owner-admin", "bad", "ip-brute");
    expect(await platform.adminLogin("owner-admin", "platform-secret", "ip-brute")).toMatchObject({ ok: false, reason: "throttled" });
  });

  it("has no admin account when nothing is configured", async () => {
    const keep = [process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD];
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    expect(platform.adminCredentials()).toEqual({ username: "", password: "" });
    expect((await platform.adminLogin("", "", "ip-none")).ok).toBe(false);
    [process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD] = keep as [string, string];
  });

  it("refuses everything without an admin session, including a business user's session", async () => {
    const anon = new NextRequest("http://localhost:3000/api/admin/businesses");
    expect((await list.GET(anon)).status).toBe(401);
    const id = await open(`Wall ${tag}`, `wall${tag}`);
    const { cookie } = await principal(`wall${tag}`);
    const asBusiness = new NextRequest("http://localhost:3000/api/admin/businesses", { headers: { cookie: `posible_sid=${cookie}` } });
    expect((await list.GET(asBusiness)).status).toBe(401);
    const forged = new NextRequest(`http://localhost:3000/api/admin/businesses/${id}`, { method: "PATCH", body: "{}", headers: { cookie: `posible_admin=${cookie}` } });
    expect((await patchRoute.PATCH(forged, { params: Promise.resolve({ id }) })).status).toBe(401);
    // …and the admin cookie is no key to a business's data.
    expect(await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${adminToken}` } }))).toBeNull();
  });

  it("shows plan, users and storage per business and nothing from inside it", async () => {
    const id = await open(`Counted ${tag}`, `counted${tag}`, "standard");
    const s = await summary(id);
    expect(Object.keys(s).sort()).toEqual(["code", "contactEmail", "contactPhone", "createdAt", "expiresAt", "free", "id", "lastActiveAt", "maxUsers", "modules", "name", "ownerUsername", "plan", "planLabel", "priceMonthly", "state", "status", "storageBytes", "users"]);
    expect(s).toMatchObject({ name: `Counted ${tag}`, ownerUsername: `counted${tag}`, plan: "standard", planLabel: "Standard", priceMonthly: 1500, state: "active", users: 1, maxUsers: 10 });
    expect(s.storageBytes).toBeGreaterThan(10_000);
    const before = s.storageBytes;
    const { p } = await principal(`counted${tag}`);
    const r = await rpc.handleRpc(p, { service: "crud:brands", method: "create", args: [{ name: "x", description: randomBytes(12000).toString("hex") }] });
    expect(r.ok).toBe(true);
    expect((await summary(id)).storageBytes).toBeGreaterThan(before + 20_000);
    // The response never carries any business record or credential.
    const raw = JSON.stringify(await (await list.GET(asAdmin("/api/admin/businesses"))).json());
    for (const secret of ["scrypt$", "owner-pass-1", "password"]) expect(raw).not.toContain(secret);
  });

  it("a cancelled or expired business cannot sign in, and a live session ends at once", async () => {
    const id = await open(`Gate ${tag}`, `gate${tag}`);
    const { cookie } = await principal(`gate${tag}`);
    const req = () => new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${cookie}` } });
    expect(await auth.authenticate(req())).not.toBeNull();

    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    expect((await patch({ status: "cancelled" })).status).toBe(200);
    expect(await auth.authenticate(req())).toBeNull();
    expect(await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g1")).toMatchObject({ ok: false, reason: "cancelled" });
    expect(await auth.login(`gate${tag}`, "wrong", true, "ip-g2")).toMatchObject({ ok: false, reason: "invalid" }); // a wrong password learns nothing

    expect((await patch({ status: "active", expiresAt: "2020-01-01T00:00:00Z" })).status).toBe(200);
    expect(await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g3")).toMatchObject({ ok: false, reason: "expired" });
    expect((await summary(id)).state).toBe("expired");

    expect((await patch({ expiresAt: new Date(Date.now() + 86_400_000).toISOString() })).status).toBe(200);
    expect((await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g4")).ok).toBe(true);
    expect((await patch({ plan: "nonsense" })).status).toBe(400);
    expect((await patchRoute.PATCH(asAdmin("/api/admin/businesses/00000000-0000-4000-8000-000000000000", { method: "PATCH", body: JSON.stringify({ status: "active" }) }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) })).status).toBe(404);
  });

  it("renewing extends from the end date, restarts a lapsed one, and switches a cancelled one back on", async () => {
    const id = await open(`Renew ${tag}`, `renew${tag}`, "starter", new Date(Date.now() + 10 * 86_400_000).toISOString());
    const post = (path: string, body: object = {}) => asAdmin(`/api/admin/businesses/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
    const renew = (await import("@/app/api/admin/businesses/[id]/renew/route")).POST;
    const cancel = (await import("@/app/api/admin/businesses/[id]/cancel/route")).POST;
    const ctx = { params: Promise.resolve({ id }) };
    const before = new Date((await summary(id)).expiresAt).getTime();

    expect((await renew(post("renew", { months: 0 }), ctx)).status).toBe(400);
    const r1 = await (await renew(post("renew", { months: 3 }), ctx)).json();
    const gained = (new Date(r1.expiresAt).getTime() - before) / 86_400_000;
    expect(gained).toBeGreaterThan(88); // three months added to the existing end date, not to today
    expect(gained).toBeLessThan(93);

    // Cancel: signed out, cannot sign in, and the message names the cause.
    const { cookie } = await principal(`renew${tag}`);
    expect((await cancel(post("cancel"), ctx)).status).toBe(200);
    expect(await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${cookie}` } }))).toBeNull();
    expect(await auth.login(`renew${tag}`, "owner-pass-1", true, "ip-c1")).toMatchObject({ ok: false, reason: "cancelled" });
    expect((await summary(id)).state).toBe("cancelled");

    // Renewing brings it back, counting from today because the old term was cancelled.
    const r2 = await (await renew(post("renew", { months: 1 }), ctx)).json();
    const fromToday = (new Date(r2.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(fromToday).toBeGreaterThan(27);
    expect(fromToday).toBeLessThan(32);
    expect((await auth.login(`renew${tag}`, "owner-pass-1", true, "ip-c2")).ok).toBe(true);
    expect((await summary(id)).state).toBe("active");

    // A first term can be given in months when the business is created.
    const res = await list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: `Term ${tag}`, username: `term${tag}`, password: "owner-pass-1", plan: "starter", months: 6 }) }));
    const termId = (await res.json()).id as string;
    ids.push(termId);
    const term = (new Date((await summary(termId)).expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(term).toBeGreaterThan(178);
    expect(term).toBeLessThan(186);
  });

  it("the package limits how many users can sign in", async () => {
    const id = await open(`Quota ${tag}`, `quota${tag}`, "starter"); // 3 users
    const { p } = await principal(`quota${tag}`);
    const make = (n: number) => rpc.handleRpc(p, { service: "crud:users", method: "create", args: [{ username: `q${n}${tag}`, firstName: `Q${n}`, lastName: "", email: "", roleId: "role_cashier", password: "pass-word-1", locationIds: [], isActive: true, allowLogin: true, prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 }] });
    expect((await make(1)).ok).toBe(true);
    expect((await make(2)).ok).toBe(true);
    expect(await make(3)).toMatchObject({ ok: false, error: { code: "plan_limit" } });
    expect((await summary(id)).users).toBe(3);
    // Upgrading the package lifts the limit.
    await patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify({ plan: "premium" }) }), { params: Promise.resolve({ id }) });
    expect((await make(3)).ok).toBe(true);
    expect((await summary(id)).maxUsers).toBeNull();
  });

  it("keeps an email and an international phone number for each business", async () => {
    const make = (extra: object) => list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: `Reach ${tag}`, username: `reach${tag}`, password: "owner-pass-1", plan: "starter", ...extra }) }));
    expect((await make({ email: "not-an-email" })).status).toBe(400);
    expect((await make({ phone: "01711000111" })).status).toBe(400); // needs the country code
    expect((await make({ phone: "+8801711000111", email: "owner@reach.example" })).status).toBe(201);
    const row = (await (await list.GET(asAdmin("/api/admin/businesses"))).json()).businesses.find((b: { name: string }) => b.name === `Reach ${tag}`);
    ids.push(row.id);
    expect(row).toMatchObject({ contactEmail: "owner@reach.example", contactPhone: "+8801711000111" });
    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${row.id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: row.id }) });
    expect((await patch({ contactPhone: "+14155550123", contactEmail: "" })).status).toBe(200);
    expect(await summary(row.id)).toMatchObject({ contactEmail: null, contactPhone: "+14155550123" });
  });

  it("deleting a business needs its owner's username and removes everything", async () => {
    const id = await open(`Doomed ${tag}`, `doomed${tag}`);
    const del = (confirmUsername: string) => patchRoute.DELETE(asAdmin(`/api/admin/businesses/${id}`, { method: "DELETE", body: JSON.stringify({ confirmUsername }) }), { params: Promise.resolve({ id }) });
    expect((await del("not-the-name")).status).toBe(422);
    expect(await summary(id)).toBeTruthy();
    const { cookie } = await principal(`doomed${tag}`);
    expect((await del(`DOOMED${tag}`)).status).toBe(200); // case doesn't matter
    expect(await summary(id)).toBeUndefined();
    expect(await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${cookie}` } }))).toBeNull();
    expect((await poolMod.pool().query("SELECT 1 FROM logins WHERE business_id = $1", [id])).rowCount).toBe(0);
    expect((await poolMod.pool().query("SELECT 1 FROM products WHERE business_id = $1", [id])).rowCount).toBe(0);
    expect((await del(`doomed${tag}`)).status).toBe(404);
    ids.splice(ids.indexOf(id), 1);
  });

  it("the owner's password can be replaced from the console but never read", async () => {
    const id = await open(`Reset ${tag}`, `reset${tag}`);
    const { cookie } = await principal(`reset${tag}`);
    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    expect((await patch({ ownerPassword: "short" })).status).toBe(400);
    expect((await patch({ ownerPassword: "a-new-password-9" })).status).toBe(200);
    expect(await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${cookie}` } }))).toBeNull();
    expect(await auth.login(`reset${tag}`, "owner-pass-1", true, "ip-r1")).toMatchObject({ ok: false, reason: "invalid" });
    expect((await auth.login(`reset${tag}`, "a-new-password-9", true, "ip-r2")).ok).toBe(true);
    const raw = JSON.stringify(await (await list.GET(asAdmin("/api/admin/businesses"))).json());
    expect(raw).not.toContain("a-new-password-9");
  });

  it("package limits and prices are editable", async () => {
    const plansRoute = await import("@/app/api/admin/plans/[id]/route");
    const edit = (id: string, body: object) => plansRoute.PATCH(asAdmin(`/api/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    expect((await edit("nope", { priceMonthly: 5 })).status).toBe(404);
    expect((await edit("starter", { priceMonthly: -1 })).status).toBe(400);
    expect((await edit("starter", { priceMonthly: 650, maxUsers: 4 })).status).toBe(200);
    const starter = (await platform.getPlans()).find((p) => p.id === "starter")!;
    expect(starter).toMatchObject({ priceMonthly: 650, maxUsers: 4 });
    await edit("starter", { priceMonthly: 500, maxUsers: 3 });
  });

  it("business A never sees business B", async () => {
    await open(`Alpha ${tag}`, `alpha${tag}`, "premium");
    await open(`Beta ${tag}`, `beta${tag}`, "premium");
    const a = await principal(`alpha${tag}`);
    const b = await principal(`beta${tag}`);
    await rpc.handleRpc(a.p, { service: "crud:brands", method: "create", args: [{ name: `AlphaOnly ${tag}`, description: "" }] });
    const seenByB = await rpc.handleRpc(b.p, { service: "crud:brands", method: "all", args: [] });
    expect(JSON.stringify(seenByB)).not.toContain("AlphaOnly");
    // A session token only ever opens its own business.
    const who = await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${a.cookie}` } }));
    expect(who?.businessId).toBe(a.p.businessId);
    expect(a.p.businessId).not.toBe(b.p.businessId);
  });

  it("modules and free accounts: price, hiding, server enforcement, no lapse", async () => {
    const id = await open(`Mods ${tag}`, `mods${tag}`, "starter");
    const user = `mods${tag}`;
    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    await platform.updateModulePrice("pos", 100);
    await platform.updateModulePrice("reports", 50);
    const base = (await platform.getPlans()).find((p) => p.id === "starter")!.priceMonthly;

    expect((await patch({ modules: ["sales"] })).status).toBe(200);
    expect((await summary(id)).modules).toEqual(["sales"]);
    const p = await principal(user);
    expect(await rpc.handleRpc(p.p, { service: "posService", method: "x", args: [] })).toMatchObject({ ok: false, error: { code: "module_off" } });
    expect((await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${p.cookie}` } })))?.modules).toEqual(["sales"]);

    expect((await patch({ modules: ["sales", "pos", "reports"] })).status).toBe(200);
    const s = await summary(id);
    expect(s.priceMonthly).toBe(base + 150 + (await platform.getModules()).find((m) => m.id === "sales")!.priceMonthly);
    expect((await patch({ modules: ["nope"] })).status).toBe(400);

    // Free: no price, every module, no limit, and an end date in the past does not lock the business out.
    expect((await patch({ free: true, expiresAt: "2020-01-01T00:00:00Z" })).status).toBe(200);
    const f = await summary(id);
    expect(f).toMatchObject({ free: true, priceMonthly: 0, state: "active", maxUsers: null });
    expect(f.modules).toHaveLength(7);
    expect((await auth.login(user, "owner-pass-1", true, "ip-free")).ok).toBe(true);
    await patch({ free: false, expiresAt: null });
    await platform.updateModulePrice("pos", 0);
    await platform.updateModulePrice("reports", 0);
  });

  it("a demo business has no onboarding; a normal one still gets the wizard", async () => {
    const make = async (username: string, demo: boolean) => {
      const res = await list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: username, username, password: "owner-pass-1", plan: "starter", demo }) }));
      expect(res.status).toBe(201);
      ids.push((await res.json()).id as string);
      const r = await auth.login(username, "owner-pass-1", true, `ip-${username}`);
      if (!r.ok) throw new Error("login failed");
      const p = { businessId: r.principal.businessId, userId: r.principal.userId, role: r.principal.role };
      return rpc.handleRpc(p, { service: "onboardingService", method: "state", args: [] });
    };
    expect(await make(`demo${tag}`, true)).toMatchObject({ ok: true, result: { onboarding: { done: true } } });
    expect(await make(`real${tag}`, false)).toMatchObject({ ok: true, result: { onboarding: { done: false } } });
  });

  it("staff sign in with business username + account name; a person only gets the modules the owner gave them", async () => {
    const id = await open(`Staff ${tag}`, `staff${tag}`, "premium");
    const owner = await principal(`staff${tag}`);
    const made = await rpc.handleRpc(owner.p, { service: "crud:users", method: "create", args: [{ username: `till${tag}`, firstName: "Till", lastName: "", email: "", roleId: "role_cashier", password: "till-pass-1", locationIds: [], isActive: true, allowLogin: true, modules: ["pos"], prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 }] });
    expect(made.ok).toBe(true);
    expect((await auth.login(`till${tag}`, "wrong-pass-1", true, "ip-s1", `staff${tag}`)).ok).toBe(false);
    expect((await auth.login(`till${tag}`, "till-pass-1", true, "ip-s2", `nobody${tag}`)).ok).toBe(false);
    const r = await auth.login(`till${tag}`, "till-pass-1", true, "ip-s3", `staff${tag}`);
    if (!r.ok) throw new Error(r.reason);
    expect(r.principal.businessId).toBe(id);
    expect(r.principal.modules).toEqual(["pos"]);
    expect((await auth.login(`staff${tag}`, "owner-pass-1", true, "ip-s4", `staff${tag}`)).ok).toBe(true);
    const blocked = await rpc.handleRpc({ businessId: id, userId: r.principal.userId, role: r.principal.role, modules: r.principal.modules }, { service: "expensesService", method: "x", args: [] });
    expect(blocked).toMatchObject({ ok: false, error: { code: "module_off" } });
  });

  it("the same staff username can exist in two businesses; the business code says which one you mean", async () => {
    await open(`Code A ${tag}`, `codea${tag}`, "premium");
    await open(`Code B ${tag}`, `codeb${tag}`, "premium");
    const mk = async (ownerName: string, pass: string) => {
      const owner = await principal(ownerName);
      const r = await rpc.handleRpc(owner.p, { service: "crud:users", method: "create", args: [{ username: `till${tag}`, firstName: "Till", lastName: "", email: "", roleId: "role_cashier", password: pass, locationIds: [], isActive: true, allowLogin: true, modules: ["pos"], prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 }] });
      expect(r.ok, JSON.stringify(r)).toBe(true);
    };
    await mk(`codea${tag}`, "pass-for-a-1");
    await mk(`codeb${tag}`, "pass-for-b-1"); // same username as in A: allowed
    const a = await auth.login(`till${tag}`, "pass-for-a-1", true, "ip-k1", `codea${tag}`);
    const b = await auth.login(`till${tag}`, "pass-for-b-1", true, "ip-k2", `CodeB${tag}`); // codes ignore case
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.principal.businessId).not.toBe(b.principal.businessId);
    // Each password only opens its own business, and staff can't sign in without a code.
    expect((await auth.login(`till${tag}`, "pass-for-a-1", true, "ip-k3", `codeb${tag}`)).ok).toBe(false);
    expect((await auth.login(`till${tag}`, "pass-for-a-1", true, "ip-k4")).ok).toBe(false);
    // A second "till" inside the same business is still refused.
    const owner = await principal(`codea${tag}`);
    const again = await rpc.handleRpc(owner.p, { service: "crud:users", method: "create", args: [{ username: `TILL${tag}`, firstName: "Dup", lastName: "", email: "", roleId: "role_cashier", password: "pass-for-a-2", locationIds: [], isActive: true, allowLogin: true, prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 }] });
    expect(again).toMatchObject({ ok: false });
  });

  it("business codes: default to the owner's username, can be chosen, must be unique, and can be changed", async () => {
    const make = (extra: object, user: string) => list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: `Cd ${user}`, username: user, password: "owner-pass-1", plan: "starter", ...extra }) }));
    const res1 = await make({}, `plain${tag}`);
    expect(res1.status).toBe(201);
    ids.push((await res1.json()).id);
    const res2 = await make({ code: `Lotus-${tag}` }, `chosen${tag}`);
    expect(res2.status).toBe(201);
    const id2 = (await res2.json()).id as string;
    ids.push(id2);
    expect(await summary(id2)).toMatchObject({ code: `lotus-${tag}` });
    expect((await make({ code: `lotus-${tag}` }, `other${tag}`)).status).toBe(409);
    expect((await make({ code: "no spaces" }, `bad${tag}`)).status).toBe(400);
    const rows = (await (await list.GET(asAdmin("/api/admin/businesses"))).json()).businesses;
    expect(rows.find((b: { name: string }) => b.name === `Cd plain${tag}`)).toMatchObject({ code: `plain${tag}` });

    // Staff reach the business by its code; changing it moves them to the new one at once.
    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id2}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: id2 }) });
    expect((await auth.login(`chosen${tag}`, "owner-pass-1", true, "ip-cc1", `lotus-${tag}`)).ok).toBe(true);
    expect((await patch({ code: `plain${tag}` })).status).toBe(409);
    expect((await patch({ code: `renamed-${tag}` })).status).toBe(200);
    expect((await auth.login(`chosen${tag}`, "owner-pass-1", true, "ip-cc2", `lotus-${tag}`)).ok).toBe(false);
    expect((await auth.login(`chosen${tag}`, "owner-pass-1", true, "ip-cc3", `renamed-${tag}`)).ok).toBe(true);
    // The owner still signs in with just a username.
    expect((await auth.login(`chosen${tag}`, "owner-pass-1", true, "ip-cc4")).ok).toBe(true);
  });
});
