// Browser smoke + accessibility check across every route, in English/light and Bangla/dark.
// Usage: npm run build && npx next start -p 3111 &  then  E2E_URL=http://localhost:3111 npm run e2e
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const routes = [...readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8").matchAll(/^\s+"(\/[^"]*)":\s*\{/gm)].map((m) => m[1]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const failures = [];
const note = (route, mode, msg) => failures.push(`${mode} ${route}: ${msg}`);

for (const [locale, theme] of [["en", "light"], ["bn", "dark"]]) {
  const mode = `[${locale}/${theme}]`;
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addCookies([{ name: "NEXT_LOCALE", value: locale, url: BASE }]);
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));

  await page.goto(`${BASE}/login`);
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("112233");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/home/, { timeout: 15000 });

  const db = await page.evaluate(() => JSON.parse(localStorage.getItem("posible:v1:db") ?? "{}").state?.db ?? {});
  const first = (arr, f = () => true) => arr?.find(f)?.id;
  const ids = {
    "/products/[id]": first(db.products), "/products/[id]/edit": first(db.products),
    "/purchases/[id]": first(db.transactions, (t) => t.type === "purchase"), "/purchases/[id]/edit": first(db.transactions, (t) => t.type === "purchase"),
    "/sales/[id]": first(db.transactions, (t) => t.type === "sell" && t.status === "final"), "/sales/[id]/edit": first(db.transactions, (t) => t.type === "sell" && t.status === "final"),
    "/stock/transfers/[id]": first(db.transactions, (t) => t.type === "stock_transfer"), "/expenses/[id]/edit": first(db.transactions, (t) => t.type === "expense"),
    "/accounts/[id]": first(db.accounts),
  };

  for (const route of routes) {
    const url = route.includes("[id]") ? (ids[route] ? route.replace("[id]", ids[route]) : null) : route;
    if (!url) { note(route, mode, "no seeded record to open"); continue; }
    errors.length = 0;
    await page.goto(BASE + url, { waitUntil: "load" });
    await page.waitForTimeout(route === "/pos" ? 2500 : 1200);
    if (await page.getByText(/coming soon/i).count()) note(route, mode, "still a placeholder");
    if (!route.startsWith("/pos") && !(await page.locator("h1").count())) note(route, mode, "no <h1>");
    const body = await page.locator("body").innerText();
    const bad = body.match(/\bNaN\b|undefined|\[object|Infinity|\bnull\b|Invalid Date|\{[a-zA-Z]+\}/);
    if (bad) note(route, mode, `leaked "${bad[0]}" into the page`);
    if (errors.length) note(route, mode, `console/page errors: ${errors.slice(0, 2).join(" | ")}`);
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
    for (const v of res.violations.filter((x) => ["serious", "critical"].includes(x.impact))) {
      // Radix Tabs points aria-controls at a panel that isn't mounted while inactive; that is by design.
      const nodes = v.id === "aria-valid-attr-value" ? v.nodes.filter((n) => !n.target.join(" ").includes("-trigger-")) : v.nodes;
      if (nodes.length) note(route, mode, `a11y ${v.id} (${v.impact}) ×${nodes.length}: ${nodes[0].target.join(" ")}`);
    }
  }
  await ctx.close();
}
await browser.close();
if (failures.length) { console.error(`${failures.length} problem(s):\n` + failures.join("\n")); process.exit(1); }
console.log(`OK — ${routes.length} routes × 2 modes`);
