// Checks the /welcome hero: one h1, no console errors, no horizontal scroll, no a11y violations, no em dashes,
// the nav and CTAs show, the dashboard screenshot loads, See demo runs a private demo shop, and the background tilts with the pointer only when motion is allowed.
// Usage: npx next dev -p 3111 &  then  E2E_URL=http://localhost:3111 npm run e2e:welcome   (OUT=dir keeps screenshots)
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const OUT = process.env.OUT ?? "e2e/.welcome-out";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
const fail = (mode, msg) => failures.push(`${mode}: ${msg}`);

async function open(ctx, mode) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(mode, `page error ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && fail(mode, `console ${m.text()}`));
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  await page.locator("h1").waitFor();
  return page;
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  const mode = `[${width}px]`;
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await open(ctx, mode);
  await page.screenshot({ path: `${OUT}/${width}.png` });

  if ((await page.locator("h1").count()) !== 1) fail(mode, "expected exactly one h1");
  const body = await page.evaluate(() => document.body.innerText);
  if (/[—–]/.test(body)) fail(mode, "em or en dash in page text");
  if (/framer|flowsuite|circular|react bits/i.test(body)) fail(mode, "reference branding in page text");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail(mode, "horizontal scroll");
  for (const name of ["Get started", "See demo"])
    if (!(await page.locator("#main").getByRole("link", { name }).isVisible())) fail(mode, `CTA "${name}" not visible`);
  if (width >= 1024) for (const name of ["Features", "Pricing", "FAQ", "Contact"])
    if (!(await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).isVisible())) fail(mode, `nav link "${name}" not visible`);
  // The card clips overflow, so also check nothing in the hero runs past the viewport edge.
  const out = await page.evaluate(() => [...document.querySelectorAll("#main *, header *, img")].filter((e) => e.tagName !== "CANVAS").filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -0.5 || r.right > innerWidth + 0.5); }).length);
  if (out) fail(mode, `${out} hero element(s) run past the viewport edge`);

  const shot = page.locator('img[alt^="The POS-sible dashboard"]');
  await shot.scrollIntoViewIfNeeded();
  if (!(await shot.evaluate((i) => i.complete && i.naturalWidth > 0))) fail(mode, "dashboard screenshot did not load");

  await page.evaluate(axeSource);
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  for (const v of result.violations.filter((x) => ["serious", "critical"].includes(x.impact)))
    fail(mode, `axe ${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`);
  await ctx.close();
}

// Tilt: the plane follows the pointer, and stays put with reduced motion.
for (const reducedMotion of ["no-preference", "reduce"]) {
  const mode = `[tilt ${reducedMotion}]`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const page = await open(ctx, mode);
  const transform = () => page.locator("[data-tilt]").evaluate((e) => e.style.transform);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(600);
  const t0 = await transform();
  await page.mouse.move(1300, 800, { steps: 10 });
  await page.waitForTimeout(800);
  const t1 = await transform();
  if (reducedMotion === "reduce" ? t0 !== t1 || /rotate/.test(t1) : !t1 || t1 === t0) fail(mode, `transform ${JSON.stringify(t0)} -> ${JSON.stringify(t1)}`);
  await ctx.close();
}

// See demo: a fresh shop seeded today, kept only in this browser under its own key, no API calls, wiped on exit.
{
  const mode = "[demo]";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await open(ctx, mode);
  const apiCalls = [];
  page.on("request", (r) => /\/api\/(rpc|auth)/.test(r.url()) && apiCalls.push(`${r.url()} ${r.postData() ?? ""} on ${page.url()}`));
  const idb = (key) => page.evaluate((k) => new Promise((res) => {
    const req = indexedDB.open("posible", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => { const g = req.result.transaction("kv").objectStore("kv").get(k); g.onsuccess = () => { req.result.close(); res(g.result ? JSON.parse(g.result).state.db?.meta?.seededAt ?? "?" : null); }; };
  }), key);
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  await page.locator("#main").getByRole("link", { name: "See demo" }).click();
  await page.waitForURL(/\/home/, { timeout: 60000 }).catch(() => fail(mode, `did not reach /home (at ${page.url()})`));
  await page.getByText("You're exploring a demo shop").waitFor({ timeout: 15000 }).catch(() => fail(mode, "demo banner not shown"));
  await page.waitForTimeout(800);
  const seeded = await idb("posible:demo:db");
  if (seeded !== today) fail(mode, `demo shop seeded ${seeded}, expected ${today}`);
  if (await idb("posible:v1:db") === seeded && process.env.E2E_API === "1") fail(mode, "demo wrote to the real shop key");
  await page.reload({ waitUntil: "networkidle" });
  if (!/\/home/.test(page.url())) fail(mode, `reload left the demo (at ${page.url()})`);
  await page.screenshot({ path: `${OUT}/demo.png` });

  await page.getByRole("button", { name: "Exit demo" }).click();
  await page.waitForURL(/\/welcome/, { timeout: 30000 }).catch(() => fail(mode, "exit did not return to /welcome"));
  await page.waitForTimeout(500);
  if (await page.evaluate(() => sessionStorage.getItem("posible:demo"))) fail(mode, "demo flag still set after exit");
  if (await idb("posible:demo:db")) fail(mode, "demo shop still stored after exit");
  if (apiCalls.length) fail(mode, `demo called the API: ${apiCalls[0]}`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`welcome: ${failures.length} problem(s)\n` + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log("welcome: OK");
