// The platform owner's console against the Postgres stack: sign in with the env credentials, open a business, see
// only totals, activate (with a transaction ID) and cancel its subscription, reset its password, and delete it by typing its username.
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
await admin.getByRole("heading", { name: "Dashboard" }).waitFor();
check(!(await admin.getByText(/default password/i).isVisible().catch(() => false)), "no default-password warning");
check(await admin.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Revenue" }).isVisible(), "the sidebar lists the admin pages");

// Businesses: add one with just a name, username, password and package.
await admin.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Businesses" }).click();
await admin.getByRole("heading", { name: "Businesses" }).waitFor();
await admin.getByRole("button", { name: "Add business" }).click();
check(!(await admin.getByLabel("Owner name").isVisible().catch(() => false)), "no owner name field");
await admin.getByLabel("Business name").fill(name);
await admin.getByLabel("Owner username").fill(owner);
await admin.getByLabel("Business code (optional)").fill(`${owner}-shop`);
await admin.getByLabel("Password", { exact: true }).fill("zeta-owner-pass");
await admin.getByLabel("Email (optional)").fill("owner@zeta.example");
await admin.getByRole("combobox", { name: /Country code/ }).click();
await admin.getByPlaceholder("Search country or code…").fill("Bangladesh");
const bd = admin.getByRole("option", { name: /Bangladesh/ }).first();
check(await bd.locator("svg").first().isVisible(), "the country list shows a flag next to each country");
check((await bd.innerText()).includes("+880"), "and its dial code");
await bd.click();
await admin.getByLabel("Phone (optional)").fill("01711000111");
await admin.getByLabel("Package").click();
await admin.getByRole("option", { name: /Starter/ }).click();
await admin.getByRole("button", { name: "Create business" }).click();
const row = admin.locator("tr", { hasText: name });
await row.waitFor();
const text = await row.innerText();
check(text.includes(owner) && text.includes(`${owner}-shop`) && /Starter/.test(text) && /Expired/.test(text) && /1 \/ 3/.test(text), "listed with username, package, an inactive status until activated, and 1 / 3 users");
check(/\d+(\.\d+)? (KB|MB)/.test(text), "storage is shown");
check(text.includes("+880 1711 000111") && text.includes("owner@zeta.example") && (await row.locator("svg.rounded-\\[3px\\]").count()) > 0, "the phone (with its flag) and email are listed");
const body = await admin.locator("main").innerText();
check(!body.includes("scrypt$") && !body.includes("zeta-owner-pass"), "no credentials or records on the page");

// A new business is switched off until the subscription is activated, and a payment needs a transaction ID or proof.
await row.getByRole("button", { name: /Actions for/ }).click();
await admin.getByRole("menuitem", { name: "Activate subscription" }).click();
check(/Active until/.test(await admin.getByRole("dialog").innerText()), "activating previews the end date");
check(await admin.getByRole("button", { name: "Activate", exact: true }).isDisabled(), "activating a paid package needs a transaction ID or proof");
await admin.getByLabel("Transaction ID").fill("TXN-E2E-1");
await admin.getByRole("button", { name: "Activate", exact: true }).click();
await admin.locator("tr", { hasText: name }).getByText("Active").waitFor();
check(true, "after activating, the business shows as active");

for (const [link, heading] of [["Users", "Users"], ["Subscriptions", "Subscriptions"], ["Revenue", "Revenue"], ["Dashboard", "Dashboard"]]) {
  await admin.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: link }).click();
  await admin.getByRole("heading", { name: heading, level: 1 }).waitFor();
  await admin.waitForTimeout(300);
  await admin.evaluate(axeSource);
  const axe = await admin.evaluate(async () => (await window.axe.run({ exclude: [[".swipe-toast"]] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`));
  check(axe.length === 0, `${heading} page is accessible ${axe.join("; ")}`);
}
check(/Monthly revenue/.test(await admin.locator("main").innerText()), "the dashboard shows revenue");

// The owner can use the app…
const shop = await newPage();
const signIn = async (password) => {
  await shop.goto(`${BASE}/login`);
  await shop.getByLabel("Username").fill(owner);
  await shop.locator('input[type="password"]').fill(password);
  await shop.getByRole("button", { name: "Sign in" }).click();
};
await signIn("zeta-owner-pass");
await shop.waitForURL(/\/home/);
check(true, "the new business owner signs in");

// The business code works from the Staff tab too (here with the owner's own account).
const staffPage = await newPage();
await staffPage.goto(`${BASE}/login`);
await staffPage.getByRole("button", { name: "Staff member" }).click();
await staffPage.getByLabel("Business code").fill(`${owner}-shop`);
await staffPage.getByLabel("Username").fill(owner);
await staffPage.locator('input[type="password"]').fill("zeta-owner-pass");
await staffPage.getByRole("button", { name: "Sign in" }).click();
await staffPage.waitForURL(/\/home/);
check(true, "signing in on the Staff tab with the business code works");
await staffPage.close();

// …until the subscription is cancelled.
await admin.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Businesses" }).click();
await admin.locator("tr", { hasText: name }).getByRole("button", { name: /Actions for/ }).click();
await admin.getByRole("menuitem", { name: "Cancel subscription" }).click();
await admin.getByRole("alertdialog").getByRole("button", { name: "Cancel subscription" }).click();
await admin.locator("tr", { hasText: name }).getByText("Cancelled").waitFor();
await shop.reload();
await shop.waitForURL(/\/login/, { timeout: 15000 });
check(true, "a live session ends when the subscription is cancelled");
await signIn("zeta-owner-pass");
const msg = shop.getByText(/renew your subscription/i);
await msg.waitFor({ timeout: 8000 });
check(/administrator/i.test(await msg.innerText()) && /cancelled/i.test(await msg.innerText()), "sign-in says the subscription is cancelled and to renew and contact the administrator");

// Activating again brings it back, with the payment written down.
await admin.locator("tr", { hasText: name }).getByRole("button", { name: /Actions for/ }).click();
await admin.getByRole("menuitem", { name: "Activate subscription" }).click();
check(/Active until/.test(await admin.getByRole("dialog").innerText()), "activating previews the new end date");
await admin.getByLabel("Transaction ID").fill("TXN-E2E-2");
await admin.getByRole("button", { name: "Activate", exact: true }).click();
await admin.locator("tr", { hasText: name }).getByText("Active").waitFor();
await signIn("zeta-owner-pass");
await shop.waitForURL(/\/home/);
check(true, "after activating, the owner can sign in again");

// A new password can be set (never read); the old one stops working.
await admin.locator("tr", { hasText: name }).getByRole("button", { name: /Actions for/ }).click();
await admin.getByRole("menuitem", { name: "Manage account" }).click();
await admin.getByLabel("New password").fill("brand-new-pass-1");
await admin.getByRole("button", { name: "Set password" }).click();
await admin.getByText(/New password set/).waitFor();
await admin.getByRole("button", { name: "Close" }).first().click();
await signIn("zeta-owner-pass");
await shop.getByText(/username or password/i).waitFor({ timeout: 8000 });
check(true, "the old password no longer works");
await signIn("brand-new-pass-1");
await shop.waitForURL(/\/home/);
check(true, "the new password works");

// Delete needs the username typed.
await admin.locator("tr", { hasText: name }).getByRole("button", { name: /Actions for/ }).click();
await admin.getByRole("menuitem", { name: "Delete business" }).click();
const confirm = admin.getByRole("button", { name: "Delete business" });
check(await confirm.isDisabled(), "delete is disabled until the username is typed");
await admin.getByLabel("Business username").fill(`${owner}x`);
check(await confirm.isDisabled(), "a wrong username keeps it disabled");
await admin.getByLabel("Business username").fill(owner);
await confirm.click();
await admin.locator("tr", { hasText: name }).waitFor({ state: "detached" });
check(true, "the business is gone from the list");
await signIn("brand-new-pass-1");
await shop.getByText(/username or password/i).waitFor({ timeout: 8000 });
check(true, "its owner can no longer sign in");

// The admin cookie opens nothing of a business's.
const rpc = await admin.evaluate(async () => (await fetch("/api/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service: "crud:users", method: "all", args: [] }) })).status);
check(rpc === 401, "the admin session cannot read business data");
check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
