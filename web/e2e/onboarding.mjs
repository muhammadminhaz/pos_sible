// Walks the first-run wizard for a brand-new shop and the self-ticking checklist.
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (ok, what) => { if (!ok) { console.error("FAIL:", what); process.exitCode = 1; } else console.log("ok  :", what); };

// The wizard is for real business accounts, so it only runs against a server (E2E_API=1, a brand-new shop from the sign-up page).
// The browser-only demo goes straight into the app: there the test checks that sign-in lands on the dashboard in brand blue with no wizard.
const BRAND_BLUE = "oklch(0.5 0.28 264.5)";
// The build rewrites colour syntax (oklch to lab), so compare rendered pixels: what --primary paints against what brand blue paints.
const accent = () => page.evaluate((brand) => {
  const ctx = document.createElement("canvas").getContext("2d");
  const rgb = (c) => { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(","); };
  return { attr: document.documentElement.getAttribute("data-accent"), primary: rgb(getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()), brand: rgb(brand) };
}, BRAND_BLUE);

if (process.env.E2E_API !== "1") {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username").fill("admin");
  await page.locator('input[type="password"]').fill("112233");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/home/);
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15000 });
  check(!(await page.getByText("Welcome to POS-sible").isVisible().catch(() => false)), "the demo skips the wizard");
  const a = await accent();
  const near = (x, y) => x.split(",").every((v, i) => Math.abs(v - y.split(",")[i]) <= 6); // gamut mapping shifts a channel by a few steps
  check(!a.attr && near(a.primary, a.brand), `the app opens in brand blue (got ${a.attr ?? "default"} ${a.primary})`);
  check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
  await browser.close();
  process.exit();
}

// Against a server: open a brand-new business through the sign-up page, as a customer would.
const user = `shop${Date.now().toString(36)}`;
await page.goto(`${BASE}/signup`);
await page.getByLabel("Business name").fill("Lotus Mart");
await page.getByLabel("Your name").fill("Lila");
await page.getByLabel("Username").fill(user);
await page.locator('input[type="password"]').fill("a long password");
await page.getByRole("button", { name: "Create your shop" }).click();
await page.waitForURL(/\/home/);

await page.getByText("Welcome to POS-sible").waitFor({ timeout: 10000 });
check(true, "wizard opens on first run");
await page.getByRole("button", { name: /Start my own shop/ }).click();
check(await page.getByText(/sample data will be replaced/i).isVisible(), "fresh start warns about replacing the demo");
await page.getByRole("button", { name: "Next" }).click();
await page.getByLabel("Business name").fill("Lotus Mart");
await page.getByLabel("Phone").fill("01711000111");
await page.getByRole("button", { name: "Next" }).click();
check((await page.getByRole("radio", { name: "blue" }).getAttribute("aria-checked")) === "true", "brand blue is the preselected colour");
await page.getByRole("radio", { name: "green" }).click();
await page.getByRole("button", { name: "Finish setup" }).click();
await page.getByRole("heading", { name: /Welcome back/ }).waitFor({ timeout: 10000 });

check(!(await page.getByText("Welcome to POS-sible").isVisible().catch(() => false)), "wizard closes");
check((await page.evaluate(() => document.documentElement.getAttribute("data-accent"))) === "green", "chosen colour applied");
check(await page.getByText("Get started").first().isVisible(), "checklist is shown");
await page.goto(`${BASE}/products`);
await page.waitForTimeout(1200);
check((await page.locator("tbody tr").count()) <= 1, "the shop starts with no products");
await page.goto(`${BASE}/products/new`);
await page.getByLabel("Product name").fill("Tea 500g");
await page.getByLabel("Purchase (exc. tax)").fill("100");
await page.getByLabel("Margin %").fill("50");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForURL(/\/products$/);
await page.goto(`${BASE}/home`);
await page.getByText("Get started").first().waitFor();
const ticked = await page.getByRole("progressbar").getAttribute("aria-valuenow");
check(ticked === "1", `adding a product ticks the checklist (got ${ticked})`);
await page.reload();
check(!(await page.getByText("Welcome to POS-sible").isVisible().catch(() => false)), "choice survives a reload");
check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
