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

  /** Opens a business and, unless told not to, activates one term with no payment so its users can sign in. */
  const open = async (name: string, username: string, plan = "starter", activate = true) => {
    const res = await list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: name, username, password: "owner-pass-1", plan }) }));
    expect(res.status).toBe(201);
    const id = (await res.json()).id as string;
    ids.push(id);
    if (activate) expect((await platform.activateSubscription(id, { terms: 1, amount: 0 })).ok).toBe(true);
    return id;
  };
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const activateRoute = async () => (await import("@/app/api/admin/businesses/[id]/activate/route")).POST;
  const activate = async (id: string, fields: Record<string, string>, proof?: Buffer) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    if (proof) form.set("proof", new File([new Uint8Array(proof)], "proof.png", { type: "image/png" }));
    const req = new NextRequest(`http://localhost:3000/api/admin/businesses/${id}/activate`, { method: "POST", body: form, headers: { cookie: `posible_admin=${adminToken}` } });
    return (await activateRoute())(req, { params: Promise.resolve({ id }) });
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
    await poolMod.pool().query("DELETE FROM rate_limits"); // counters persist in Postgres, so start each run clean
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

  it("a new business cannot sign in until the admin activates it; activating records the payment with its transaction id and proof", async () => {
    const id = await open(`Pay ${tag}`, `pay${tag}`, "starter", false);
    expect(await auth.login(`pay${tag}`, "owner-pass-1", true, "ip-pay0")).toMatchObject({ ok: false, reason: "expired" });
    const price = (await platform.getPlans()).find((p) => p.id === "starter")!.price;
    const paid = async () => Number((await poolMod.pool().query("SELECT COALESCE(SUM(amount), 0) AS s FROM subscription_payments WHERE business_id = $1", [id])).rows[0].s);

    expect((await activate(id, { terms: "2" })).status).toBe(422); // money without a transaction id or proof is refused
    expect(await paid()).toBe(0);
    const res = await activate(id, { terms: "2", reference: "TXN-123" });
    expect(res.status).toBe(200);
    expect(await paid()).toBe(price * 2); // list price times the terms
    expect((await auth.login(`pay${tag}`, "owner-pass-1", true, "ip-pay1")).ok).toBe(true);
    expect((await activate(id, { terms: "1", amount: "100" }, PNG)).status).toBe(200); // a proof image alone is enough
    expect(await paid()).toBe(price * 2 + 100);
    expect((await activate(id, { terms: "1", amount: "0" })).status).toBe(200); // zero adds no money (but is still an activation)
    expect(await paid()).toBe(price * 2 + 100);
    expect((await activate(id, { terms: "1", amount: "-5" })).status).toBe(400);
    expect((await activate(id, { terms: "1", amount: "50", reference: "x" }, Buffer.from("<svg onload=alert(1)>"))).status).toBe(415); // only real images
    expect((await activate(id, { terms: "0", reference: "x" })).status).toBe(400);

    const payments = await platform.listPayments(id);
    expect(payments).toHaveLength(3); // including the zero-amount activation
    expect(payments.find((p) => p.reference === "TXN-123")).toMatchObject({ amount: price * 2, terms: 2, hasProof: false });
    const withProof = payments.find((p) => p.hasProof)!;
    expect(withProof.amount).toBe(100);
    const proof = await (await import("@/app/api/admin/payments/[id]/proof/route")).GET(asAdmin(`/api/admin/payments/${withProof.id}/proof`), { params: Promise.resolve({ id: String(withProof.id) }) });
    expect(proof.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await proof.arrayBuffer()).equals(PNG)).toBe(true);

    const report = await platform.revenueReport();
    expect(report.months).toHaveLength(12);
    expect(report.total).toBeGreaterThanOrEqual(price * 2 + 100);
    expect(report.recent.some((r) => r.businessId === id && r.businessName === `Pay ${tag}`)).toBe(true);

    // Revenue already earned stays in the books when the customer goes.
    await poolMod.pool().query("DELETE FROM businesses WHERE id = $1", [id]);
    const kept = await poolMod.pool().query("SELECT business_id, business_name FROM subscription_payments WHERE business_name = $1", [`Pay ${tag}`]);
    expect(kept.rowCount).toBe(3);
    expect(kept.rows[0].business_id).toBeNull();
    await poolMod.pool().query("DELETE FROM subscription_payments WHERE business_name = $1", [`Pay ${tag}`]);
  });

  it("records an activation of a free business with no amount, and it never counts as revenue", async () => {
    const id = await open(`Free ${tag}`, `free${tag}`);
    await platform.setSubscription(id, { free: true });
    expect((await activate(id, { terms: "3" })).status).toBe(200);
    expect((await platform.listPayments(id)).map((p) => p.amount)).toEqual([0, 0]); // the helper's activation and this one
    expect((await summary(id)).lastPaidAt).toBeNull(); // no money, so never "last paid"
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
    expect(Object.keys(s).sort()).toEqual(["code", "contactEmail", "contactPhone", "createdAt", "expiresAt", "free", "id", "lastActiveAt", "lastPaidAt", "maxUsers", "modules", "name", "nextPlan", "nextPlanLabel", "ownerUsername", "periodCount", "periodUnit", "plan", "planLabel", "planModules", "price", "priceMonthly", "state", "status", "storageBytes", "users"]);
    expect(s).toMatchObject({ name: `Counted ${tag}`, ownerUsername: `counted${tag}`, plan: "standard", planLabel: "Standard", price: 1500, periodUnit: "month", priceMonthly: 1500, state: "active", users: 1, maxUsers: 10 });
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

    expect((await patch({ status: "active" })).status).toBe(200);
    await platform.setSubscription(id, { expiresAt: "2020-01-01T00:00:00Z" });
    expect(await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g3")).toMatchObject({ ok: false, reason: "expired" });
    expect((await summary(id)).state).toBe("expired");

    await platform.setSubscription(id, { expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await auth.login(`gate${tag}`, "owner-pass-1", true, "ip-g4")).ok).toBe(true);
    expect((await patchRoute.PATCH(asAdmin("/api/admin/businesses/00000000-0000-4000-8000-000000000000", { method: "PATCH", body: JSON.stringify({ status: "active" }) }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) })).status).toBe(404);
  });

  it("activating extends from the end date, restarts a lapsed one, and switches a cancelled one back on", async () => {
    const id = await open(`Renew ${tag}`, `renew${tag}`);
    const cancel = (await import("@/app/api/admin/businesses/[id]/cancel/route")).POST;
    const ctx = { params: Promise.resolve({ id }) };
    const before = new Date((await summary(id)).expiresAt).getTime();

    const r1 = await (await activate(id, { terms: "3", amount: "0" })).json();
    const gained = (new Date(r1.expiresAt).getTime() - before) / 86_400_000;
    expect(gained).toBeGreaterThan(88); // three terms added to the existing end date, not to today
    expect(gained).toBeLessThan(93);

    // Cancel: signed out, cannot sign in, and the message names the cause.
    const { cookie } = await principal(`renew${tag}`);
    expect((await cancel(asAdmin(`/api/admin/businesses/${id}/cancel`, { method: "POST" }), ctx)).status).toBe(200);
    expect(await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${cookie}` } }))).toBeNull();
    expect(await auth.login(`renew${tag}`, "owner-pass-1", true, "ip-c1")).toMatchObject({ ok: false, reason: "cancelled" });
    expect((await summary(id)).state).toBe("cancelled");

    // Activating brings it back, counting from today because the old term was cancelled.
    const r2 = await (await activate(id, { terms: "1", amount: "0" })).json();
    const fromToday = (new Date(r2.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(fromToday).toBeGreaterThan(27);
    expect(fromToday).toBeLessThan(32);
    expect((await auth.login(`renew${tag}`, "owner-pass-1", true, "ip-c2")).ok).toBe(true);
    expect((await summary(id)).state).toBe("active");
  });

  it("the platform currency is set by the admin, validated, and reported by /me", async () => {
    const settings = await import("@/app/api/admin/settings/route");
    const me = await import("@/app/api/admin/me/route");
    const patch = (currency: string) => settings.PATCH(asAdmin("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ currency }) }));
    expect((await patch("XXX1")).status).toBe(400);
    expect((await patch("USD")).status).toBe(200);
    expect((await (await me.GET(asAdmin("/api/admin/me"))).json()).currency).toBe("USD");
    expect((await patch("BDT")).status).toBe(200);
  });

  it("any number of packages, with day, week or month terms: a weekly package gives one week per activation", async () => {
    const plansRoute = await import("@/app/api/admin/plans/route");
    const make = (body: object) => plansRoute.POST(asAdmin("/api/admin/plans", { method: "POST", body: JSON.stringify(body) }));
    expect((await make({ label: "", price: 10, periodUnit: "week", periodCount: 1, modules: [] })).status).toBe(400);
    expect((await make({ label: "Bad", price: 10, periodUnit: "year", periodCount: 1, modules: [] })).status).toBe(400);
    const weekly = (await (await make({ label: `Weekly ${tag}`, price: 120, periodUnit: "week", periodCount: 1, modules: ["pos", "sales"], maxUsers: 2 })).json()).plan;
    const daily = (await (await make({ label: `Daily ${tag}`, price: 20, periodUnit: "day", periodCount: 3, modules: ["pos"] })).json()).plan;
    expect(weekly).toMatchObject({ price: 120, periodUnit: "week", periodCount: 1, modules: ["pos", "sales"], maxUsers: 2 });
    expect((await platform.getPlans()).length).toBeGreaterThanOrEqual(5); // the three defaults and these two

    const id = await open(`Weekly ${tag}`, `weekly${tag}`, weekly.id, false);
    const r = await (await activate(id, { terms: "1", reference: "W1" })).json();
    expect((new Date(r.expiresAt).getTime() - Date.now()) / 86_400_000).toBeGreaterThan(6.9);
    expect((new Date(r.expiresAt).getTime() - Date.now()) / 86_400_000).toBeLessThan(7.1);
    expect(await summary(id)).toMatchObject({ plan: weekly.id, price: 120, periodUnit: "week", modules: ["pos", "sales"], maxUsers: 2 });
    expect((await summary(id)).priceMonthly).toBeCloseTo((120 * 30) / 7, 5);

    // The package decides the modules: a business can switch some off but never gets one the package lacks.
    await platform.setSubscription(id, { modules: ["pos", "reports"] });
    expect((await summary(id)).modules).toEqual(["pos"]);

    // In use, a package cannot be deleted; unused, it can.
    const planRoute = await import("@/app/api/admin/plans/[id]/route");
    const del = (planId: string) => planRoute.DELETE(asAdmin(`/api/admin/plans/${planId}`, { method: "DELETE" }), { params: Promise.resolve({ id: planId }) });
    expect((await del(weekly.id)).status).toBe(409);
    expect((await del(daily.id)).status).toBe(200);
    expect((await del(daily.id)).status).toBe(404);
    await poolMod.pool().query("DELETE FROM businesses WHERE id = $1", [id]);
    ids.splice(ids.indexOf(id), 1);
    expect((await del(weekly.id)).status).toBe(200);
  });

  it("upgrade or downgrade immediately starts a fresh term; scheduled, it waits for the next activation", async () => {
    const id = await open(`Move ${tag}`, `move${tag}`, "starter");
    const starter = (await platform.getPlans()).find((p) => p.id === "starter")!;
    const premium = (await platform.getPlans()).find((p) => p.id === "premium")!;
    await activate(id, { terms: "3", amount: "0" }); // about 3 months of runway on Starter

    // Scheduled: nothing changes today.
    const schedule = (await import("@/app/api/admin/businesses/[id]/schedule/route")).POST;
    const sched = (plan: string | null) => schedule(asAdmin(`/api/admin/businesses/${id}/schedule`, { method: "POST", body: JSON.stringify({ plan }) }), { params: Promise.resolve({ id }) });
    expect((await sched("nope")).status).toBe(400);
    expect((await sched(premium.id)).status).toBe(200);
    expect(await summary(id)).toMatchObject({ plan: "starter", nextPlan: "premium", nextPlanLabel: premium.label });
    expect((await sched(starter.id)).status).toBe(200); // choosing the current package clears it
    expect((await summary(id)).nextPlan).toBeNull();
    await sched(premium.id);
    const before = new Date((await summary(id)).expiresAt).getTime();
    const next = await (await activate(id, { terms: "1", reference: "UP1" })).json(); // the next activation applies it, after the old end date
    expect(await summary(id)).toMatchObject({ plan: "premium", nextPlan: null, maxUsers: null });
    expect((new Date(next.expiresAt).getTime() - before) / 86_400_000).toBeGreaterThan(27);

    // Immediate: the old term is over and a fresh one starts today, paid for now.
    const now = await (await activate(id, { terms: "1", plan: "starter", restart: "true", reference: "DOWN1" })).json();
    expect(await summary(id)).toMatchObject({ plan: "starter", maxUsers: 3 });
    const days = (new Date(now.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
    expect((await activate(id, { terms: "1", plan: "nope", reference: "x" })).status).toBe(400);
    const paid = (await platform.listPayments(id)).map((p) => p.reference).filter(Boolean);
    expect(paid).toEqual(["DOWN1", "UP1"]);
  });

  it("the package limits how many users a business can have", async () => {
    const id = await open(`Quota ${tag}`, `quota${tag}`, "starter"); // 3 users
    const { p } = await principal(`quota${tag}`);
    const make = (n: number, allowLogin = true) => rpc.handleRpc(p, { service: "crud:users", method: "create", args: [{ username: `q${n}${tag}`, firstName: `Q${n}`, lastName: "", email: "", roleId: "role_cashier", password: "pass-word-1", locationIds: [], isActive: true, allowLogin, prefix: "", language: "en", maxSalesDiscountPercent: null, avatar: null, profile: {}, bankDetails: {}, isSalesAgent: false, commissionPercent: 0 }] });
    expect((await make(1)).ok).toBe(true);
    expect((await make(2)).ok).toBe(true);
    expect(await make(3)).toMatchObject({ ok: false, error: { code: "plan_limit" } });
    expect(await make(3, false)).toMatchObject({ ok: false, error: { code: "plan_limit" } }); // a user who can't sign in still counts
    expect((await summary(id)).users).toBe(3);
    // Upgrading the package lifts the limit.
    await platform.activateSubscription(id, { terms: 1, plan: "premium", restart: true, amount: 0 });
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

  it("package limits, prices, terms and modules are editable", async () => {
    const plansRoute = await import("@/app/api/admin/plans/[id]/route");
    const edit = (id: string, body: object) => plansRoute.PATCH(asAdmin(`/api/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
    expect((await edit("nope", { price: 5 })).status).toBe(404);
    expect((await edit("starter", { price: -1 })).status).toBe(400);
    expect((await edit("starter", { periodCount: 0 })).status).toBe(400);
    expect((await edit("starter", { price: 650, maxUsers: 4, periodUnit: "week", modules: ["pos"] })).status).toBe(200);
    expect((await platform.getPlans()).find((p) => p.id === "starter")).toMatchObject({ price: 650, maxUsers: 4, periodUnit: "week", modules: ["pos"] });
    await edit("starter", { price: 500, maxUsers: 3, periodUnit: "month", modules: ["pos", "sales", "purchases", "stock", "expenses", "accounts", "reports"] });
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

  it("modules and free accounts: package modules, hiding, server enforcement, no lapse", async () => {
    const id = await open(`Mods ${tag}`, `mods${tag}`, "starter");
    const user = `mods${tag}`;
    const patch = (body: object) => patchRoute.PATCH(asAdmin(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

    expect((await patch({ modules: ["sales"] })).status).toBe(200);
    expect((await summary(id)).modules).toEqual(["sales"]);
    const p = await principal(user);
    expect(await rpc.handleRpc(p.p, { service: "posService", method: "x", args: [] })).toMatchObject({ ok: false, error: { code: "module_off" } });
    expect((await auth.authenticate(new NextRequest("http://localhost:3000/api/rpc", { headers: { cookie: `posible_sid=${p.cookie}` } })))?.modules).toEqual(["sales"]);

    expect((await patch({ modules: ["sales", "pos", "reports"] })).status).toBe(200);
    expect((await summary(id)).modules).toEqual(["pos", "sales", "reports"]);
    expect((await patch({ modules: ["nope"] })).status).toBe(400);

    // Free: no price, every module, no limit, and an end date in the past does not lock the business out.
    expect((await patch({ free: true })).status).toBe(200);
    await platform.setSubscription(id, { expiresAt: "2020-01-01T00:00:00Z" });
    const f = await summary(id);
    expect(f).toMatchObject({ free: true, price: 0, priceMonthly: 0, state: "active", maxUsers: null });
    expect(f.modules).toHaveLength(7);
    expect((await auth.login(user, "owner-pass-1", true, "ip-free")).ok).toBe(true);
  });

  it("a new business starts with only its owner and the welcome wizard", async () => {
    const make = async (username: string) => {
      const res = await list.POST(asAdmin("/api/admin/businesses", { method: "POST", body: JSON.stringify({ businessName: username, username, password: "owner-pass-1", plan: "starter" }) }));
      expect(res.status).toBe(201);
      const made = (await res.json()).id as string;
      ids.push(made);
      await platform.activateSubscription(made, { terms: 1, amount: 0 });
      const r = await auth.login(username, "owner-pass-1", true, `ip-${username}`);
      if (!r.ok) throw new Error("login failed");
      const p = { businessId: r.principal.businessId, userId: r.principal.userId, role: r.principal.role };
      return rpc.handleRpc(p, { service: "onboardingService", method: "state", args: [] });
    };
    expect(await make(`real${tag}`)).toMatchObject({ ok: true, result: { onboarding: { done: false } } });
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
    await platform.activateSubscription(id2, { terms: 1, amount: 0 });
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
