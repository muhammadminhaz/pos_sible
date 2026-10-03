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
    return { cookie: r.token, p: { businessId: r.principal.businessId, userId: r.principal.userId, role: r.principal.role } };
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

  it("falls back to minhaz / 11111111 when nothing is configured", () => {
    const keep = [process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD];
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    expect(platform.adminCredentials()).toMatchObject({ username: "minhaz", password: "11111111", isDefault: true });
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
    expect(Object.keys(s).sort()).toEqual(["createdAt", "expiresAt", "id", "lastActiveAt", "maxUsers", "name", "ownerUsername", "plan", "planLabel", "priceMonthly", "state", "status", "storageBytes", "users"]);
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

  it("a suspended or expired business cannot sign in, and a live session ends at once", async () => {
    const id = await open(`Gate ${tag}`, `gate${tag}`);
    const { cookie } = await principal(`gate${tag}`);
    const req = () => new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${cookie}` } });
    expect(await auth.authenticate(req())).not.toBeNull();

    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    expect((await patch({ status: "suspended" })).status).toBe(200);
    expect(await auth.authenticate(req())).toBeNull();
    expect(await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g1")).toMatchObject({ ok: false, reason: "suspended" });
    expect(await auth.login(`gate${tag}`, "wrong", true, "ip-g2")).toMatchObject({ ok: false, reason: "invalid" }); // a wrong password learns nothing

    expect((await patch({ status: "active", expiresAt: "2020-01-01T00:00:00Z" })).status).toBe(200);
    expect(await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g3")).toMatchObject({ ok: false, reason: "expired" });
    expect((await summary(id)).state).toBe("expired");

    expect((await patch({ expiresAt: new Date(Date.now() + 86_400_000).toISOString() })).status).toBe(200);
    expect((await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g4")).ok).toBe(true);
    expect((await patch({ plan: "nonsense" })).status).toBe(400);
    expect((await patchRoute.PATCH(asAdmin("/api/admin/businesses/00000000-0000-4000-8000-000000000000", { method: "PATCH", body: JSON.stringify({ status: "active" }) }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) })).status).toBe(404);
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
});
