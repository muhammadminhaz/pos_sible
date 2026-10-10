// Checks the public home page (/): every section renders and fills the viewport, no console errors, no horizontal scroll,
// no a11y violations in light and dark. Saves a screenshot per section and a scroll+hover video.
// Usage: npx next dev -p 3111 &  then  E2E_URL=http://localhost:3111 npm run e2e:landing   (OUT=dir to keep the images and video)
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const OUT = process.env.OUT ?? "e2e/.landing-out";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const SECTIONS = ["hero", "loop", "problem", "inbox", "goals", "predict", "intelligence", "map", "basics", "how", "pricing", "faq", "cta", "footer"];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
const fail = (mode, msg) => failures.push(`${mode}: ${msg}`);

async function open(ctx, mode) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(mode, `page error ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && fail(mode, `console ${m.text()}`));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  return page;
}

async function axe(page, mode) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  for (const v of result.violations.filter((x) => ["serious", "critical"].includes(x.impact)))
    fail(mode, `axe ${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`);
}

for (const [width, height, theme] of [[1440, 900, "light"], [390, 844, "light"], [1440, 900, "dark"]]) {
  const mode = `[${width}px ${theme}]`;
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
  const page = await open(ctx, mode);

  for (const id of SECTIONS) {
    const el = page.locator(`#${id}`);
    if (!(await el.count())) { fail(mode, `missing section #${id}`); continue; }
    if (id !== "footer" && !(await el.locator("h1, h2").count())) fail(mode, `#${id} has no heading`);
    if (theme === "light") {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await el.screenshot({ path: `${OUT}/${width}-${id}.png` }).catch(() => {});
    }
  }
  if ((await page.locator("h1").count()) !== 1) fail(mode, "expected exactly one h1");
  const body = await page.evaluate(() => document.body.innerText);
  if (/—/.test(body)) fail(mode, "em dash in page text");
  if (/framer|qarin/i.test(body)) fail(mode, "reference branding in page text");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail(mode, "horizontal scroll");
  if (!(await page.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily)).includes("Geist")) fail(mode, "h1 is not Geist");

  for (const id of SECTIONS) {
    const h = await page.locator(`#${id}`).evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
    if (h < height) fail(mode, `#${id} is ${h}px, shorter than the viewport`);
  }
  if (width === 1440 && theme === "light") {
    // Nothing on / may touch the app data or the server.
    const dbs = await page.evaluate(() => indexedDB.databases?.().then((l) => l.map((d) => d.name)));
    if (dbs?.includes("posible")) fail(mode, "landing seeded the browser database");
  }
  await axe(page, mode);
  await ctx.close();
}

// Scroll and hover recording at the reference's size, with motion on.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
  const page = await open(ctx, "[video]");
  await page.waitForTimeout(1200);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 420) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(700);
    const targets = await page.evaluate(() =>
      [...document.querySelectorAll("a, button, summary, [role=tab], [role=radio]")]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.top > 70 && r.bottom < innerHeight && r.width > 40 && r.height > 20 && r.width < 700)
        .slice(0, 4)
        .map((r) => [r.x + r.width / 2, r.y + r.height / 2]),
    );
    for (const [x, ty] of targets) { await page.mouse.move(x, ty, { steps: 8 }); await page.waitForTimeout(250); }
  }
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`landing: ${failures.length} problem(s)\n` + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log("landing: OK");
