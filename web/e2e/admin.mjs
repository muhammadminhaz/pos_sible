// The platform owner's console against the Postgres stack: sign in with the default env credentials, open a business,
// see only totals, and watch a suspension block that business's own sign-in.
// Usage: both servers running (see README, section B), then E2E_URL=http://localhost:3111 npm run e2e:admin
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const USER = process.env.ADMIN_USERNAME ?? "minhaz";
const PASS = process.env.ADMIN_PASSWORD ?? "11111111";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const check = (ok, what) => { if (!ok) { console.error("FAIL:", what); process.exitCode = 1; } else console.log("ok  :", what); };
const errors = [];
const newPage = async () => {
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
};

const name = `Zeta Mart ${Date.now().toString(36)}`;
const owner = `zeta${Date.now().toString(36)}`;

const admin = await newPage();
await admin.goto(`${BASE}/admin`);
await admin.getByLabel("Username").fill(USER);
await admin.getByLabel("Password").fill("wrong-password");
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.getByText(/isn.t right/).waitFor();
check(true, "wrong password is refused");
await admin.getByLabel("Password").fill(PASS);
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.getByRole("heading", { name: "Platform admin" }).waitFor();
check(await admin.getByRole("heading", { name: "Platform admin" }).isVisible(), "admin signs in with the env credentials");
await admin.getByText("User accounts").waitFor();
check(await admin.getByText("Storage used").isVisible(), "totals for users and storage are shown");

await admin.getByRole("button", { name: "Add business" }).click();
await admin.getByLabel("Business name").fill(name);
await admin.getByLabel("Owner name").fill("Zeta Owner");
await admin.getByLabel("Owner username").fill(owner);
await admin.getByLabel("Owner password").fill("zeta-owner-pass");
await admin.getByLabel("Package").selectOption("starter");
await admin.getByRole("button", { name: "Create business" }).click();
const row = admin.locator("tr", { hasText: name });
await row.waitFor();
const text = await row.innerText();
check(/Starter/.test(text) && /Active/.test(text) && /1 \/ 3/.test(text), "new business listed with package, status and 1 / 3 users");
check(/\d+(\.\d+)? (KB|MB)/.test(text), "storage is shown");
const body = await admin.locator("main").innerText();
check(!body.includes("scrypt$") && !body.includes("zeta-owner-pass"), "no credentials or records on the page");
await admin.evaluate(axeSource);
const axe = await admin.evaluate(async () => (await window.axe.run({ exclude: [["[data-sonner-toaster]"]] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90) + " " + (n.any[0]?.message ?? "")).join(" | ")}`));
check(axe.length === 0, `admin page is accessible ${axe.join(", ")}`);

// The owner can use the app…
const shop = await newPage();
const signIn = async (password = "zeta-owner-pass") => {
  await shop.goto(`${BASE}/login`);
  await shop.getByLabel("Username").fill(owner);
  await shop.locator('input[type="password"]').fill(password);
  await shop.getByRole("button", { name: "Sign in" }).click();
};
await signIn();
await shop.waitForURL(/\/home/);
check(true, "the new business owner signs in");

// …until the subscription is switched off.
await row.getByRole("button", { name: "Manage" }).click();
await admin.getByLabel(/Subscription is on/).uncheck();
await admin.getByRole("button", { name: "Save" }).click();
await admin.locator("tr", { hasText: name }).getByText("Suspended").waitFor();
check(true, "suspending shows in the list");
await shop.reload();
await shop.waitForURL(/\/login/, { timeout: 15000 });
check(true, "a live session ends when the subscription is switched off");
await signIn();
await shop.getByText(/switched off/i).waitFor({ timeout: 8000 });
check(true, "sign-in explains the account is switched off");

// The admin cookie opens nothing of a business's.
const rpc = await admin.evaluate(async () => (await fetch("/api/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service: "crud:users", method: "all", args: [] }) })).status);
check(rpc === 401, "the admin session cannot read business data");
check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
