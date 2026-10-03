// Browser journey against the Postgres-backed server (build with NEXT_PUBLIC_DATA_MODE=api, DATABASE_URL set).
//   E2E_URL=http://localhost:3112 npm run e2e:api
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3112";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
let failed = false;
const check = (ok, what) => { if (!ok) { failed = true; console.error("FAIL:", what); } else console.log("ok  :", what); };
const errors = [];
const open = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
};
const signIn = async (page, user, pass) => {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username").fill(user);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
};

// 1. Not signed in: protected pages bounce to the sign-in page, wrong passwords are refused.
const a = await open();
await a.page.goto(`${BASE}/products`);
await a.page.waitForURL(/\/login/);
check(true, "an anonymous visitor is sent to sign in");
await signIn(a.page, "admin", "nope");
await a.page.getByText("Wrong username or password").waitFor({ timeout: 8000 });
check(true, "a wrong password is refused");

// 2. Sign in, skip the wizard, make a product and a sale; everything is stored on the server.
await signIn(a.page, "admin", "112233");
await a.page.waitForURL(/\/home/);
await a.page.getByRole("button", { name: /Skip, keep the demo/ }).click({ timeout: 6000 }).catch(() => {}); // already done on a later run
const name = `API Widget ${Date.now().toString().slice(-5)}`;
await a.page.goto(`${BASE}/products/new`);
await a.page.getByLabel("Product name").fill(name);
await a.page.getByLabel("Purchase (exc. tax)").fill("100");
await a.page.getByLabel("Margin %").fill("50");
await a.page.getByRole("button", { name: "Save", exact: true }).click();
await a.page.waitForURL(/\/products$/);
check(true, "a product saves through the server");

// 3. A second browser (another device) signs in and sees it, without sharing any storage with the first.
const b = await open();
await signIn(b.page, "admin", "112233");
await b.page.waitForURL(/\/home/);
await b.page.goto(`${BASE}/products`);
await b.page.getByPlaceholder("Search…").fill(name);
await b.page.waitForTimeout(1500);
check(await b.page.getByText(name).first().isVisible(), "a second device sees the new product");

// 4. A cashier gets a cashier's menu and the server refuses what the menu hides.
const c = await open();
await signIn(c.page, "cashier", "112233");
await c.page.waitForURL(/\/home/);
await c.page.goto(`${BASE}/reports/profit-loss`);
await c.page.waitForTimeout(1200);
check(await c.page.getByText(/don't have access/i).first().isVisible(), "a cashier is blocked from the profit report");
const status = await c.page.evaluate(async () => (await fetch("/api/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service: "moneyReports", method: "profitLoss", args: [{}] }) })).json());
check(status.ok === false && status.error.name === "ForbiddenError", "…and so is a direct call to the server");

// 4b. The till still works for the cashier on the restricted account: open the register, ring up a sale, take cash.
await c.page.goto(`${BASE}/pos`);
await c.page.waitForTimeout(2500);
if (await c.page.locator("#opening-cash").count()) {
  await c.page.fill("#opening-cash", "500");
  await c.page.keyboard.press("Enter");
  await c.page.waitForTimeout(1500);
}
await c.page.locator("section button").filter({ hasText: /৳/ }).first().click();
await c.page.getByRole("button", { name: /^Cash/ }).click();
await c.page.getByText(/Sale .* completed/).first().waitFor({ timeout: 10000 });
check(true, "a cashier completes a POS sale");

// 5. Sign out really ends the session.
await a.page.getByRole("button", { name: /Mahmud/ }).first().click();
await a.page.getByRole("menuitem", { name: "Sign out" }).click();
await a.page.waitForURL(/\/login/);
const after = await a.page.evaluate(async () => (await fetch("/api/auth/me")).status);
check(after === 401, "signing out ends the session on the server");

check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
process.exit(failed ? 1 : 0);
