// Several people, one shop: who-did-what columns, switching user, and the role permission grid.
// Usage: npm run build && npx next start -p 3111 &  then  E2E_URL=http://localhost:3111 npm run e2e:team
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (ok, what) => { if (!ok) { console.error("FAIL:", what); process.exitCode = 1; } else console.log("ok  :", what); };

async function signIn(username) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username").fill(username);
  await page.locator('input[type="password"]').fill("112233");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/home/);
  await page.getByRole("button", { name: /skip, keep the demo/i }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
}
const showAuditColumns = async () => {
  await page.getByRole("button", { name: /Columns/ }).click();
  for (const n of ["Created by", "Updated by", "Updated at"]) await page.getByRole("menuitemcheckbox", { name: n }).click();
  await page.keyboard.press("Escape");
};

// Admin adds a brand.
await signIn("admin");
await page.goto(`${BASE}/products/brands`);
await page.getByRole("button", { name: /add brand/i }).click();
await page.getByLabel("Name").fill("Team Test Brand");
await page.getByRole("button", { name: "Save" }).click();
await page.getByRole("dialog").waitFor({ state: "detached" });
await page.locator("main").getByPlaceholder(/search/i).first().fill("Team Test");
await page.getByRole("table").getByText("Team Test Brand").waitFor();
await showAuditColumns();
const row = page.getByRole("table").locator("tr", { hasText: "Team Test Brand" });
check((await row.innerText()).includes("Mahmud"), "created by shows the admin");

// A manager (switch user) edits it; created-by stays, updated-by changes.
await page.getByRole("button", { name: /Mahmud/ }).click();
await page.getByRole("menuitem", { name: "Switch user" }).click();
await page.waitForURL(/\/login/);
await signIn("rafiq");
await page.goto(`${BASE}/products/brands`);
await page.locator("main").getByPlaceholder(/search/i).first().fill("Team Test");
await page.getByRole("table").locator("tr", { hasText: "Team Test Brand" }).getByRole("button").last().click();
await page.getByRole("menuitem", { name: "Edit" }).click();
await page.getByLabel("Name").fill("Team Test Brand 2");
await page.getByRole("button", { name: "Save" }).click();
await page.getByRole("dialog").waitFor({ state: "detached" });
await page.getByRole("table").getByText("Team Test Brand 2").waitFor();
const text = await page.getByRole("table").locator("tr", { hasText: "Team Test Brand 2" }).innerText();
check(text.includes("Mahmud") && text.includes("Rafiq"), "created by is the admin and updated by is the manager");
// The manager role has no delete permission for brands.
await page.getByRole("table").locator("tr", { hasText: "Team Test Brand 2" }).getByRole("button").last().click();
check(!(await page.getByRole("menuitem", { name: "Delete" }).isVisible().catch(() => false)), "no Delete action without the delete permission");
await page.keyboard.press("Escape");

// The role grid (back to the admin).
await page.getByRole("button", { name: /Rafiq/ }).click();
await page.getByRole("menuitem", { name: "Switch user" }).click();
await page.waitForURL(/\/login/);
await signIn("admin");
await page.goto(`${BASE}/settings/roles`);
await page.locator("tr", { hasText: "Cashier" }).getByRole("button").last().click();
await page.getByRole("menuitem", { name: "Edit" }).click();
const grid = page.getByRole("table");
await grid.waitFor();
check((await grid.getByRole("row").count()) > 15, "the permission grid lists every area");
check(await grid.getByRole("checkbox", { name: "Customers — Delete" }).isVisible(), "each area has View / Create / Update / Delete switches");
await page.evaluate(axeSource);
const axe = await page.evaluate(async () => (await window.axe.run(document, { rules: { "color-contrast": { enabled: true } } })).violations.map((v) => `${v.id}: ${v.nodes.length}`));
check(axe.length === 0, `role dialog is accessible ${axe.join(", ")}`);
check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
