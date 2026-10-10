// Captures the demo dashboard (/home, English, light) as the product shot on /welcome.
// Usage: npx next dev -p 3111 &  then  E2E_URL=http://localhost:3111 node scripts/capture-dashboard.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const OUT = "public/welcome/dashboard.png";

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light" });
await ctx.addCookies([{ name: "NEXT_LOCALE", value: "en", url: BASE }]);
await ctx.addInitScript(() => { try { localStorage.setItem("theme", "light"); } catch {} });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator("input").first().fill("admin");
await page.locator('input[type="password"]').fill("112233");
await page.keyboard.press("Enter");
await page.waitForURL(/\/home/, { timeout: 60000 });
await page.getByRole("button", { name: /Skip, keep the demo/ }).click({ timeout: 8000 }).catch(() => {});

await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
// The greeting types itself out; wait until it stops changing. Hide the Next dev badge.
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
let last = "";
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  const now = await page.locator("main").innerText();
  if (now === last) break;
  last = now;
}
await page.waitForTimeout(800);
mkdirSync("public/welcome", { recursive: true });
await page.screenshot({ path: OUT });
console.log(`saved ${OUT}`);
await browser.close();
