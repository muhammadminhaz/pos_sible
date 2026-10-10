// Checks the waitlist page on /: one h1 in Geist, no console errors, no horizontal scroll,
// no a11y violations, no em dashes, and every form state (invalid, error, success) with /api/waitlist mocked.
// Usage: npx next dev -p 3111 &  then  E2E_URL=http://localhost:3111 npm run e2e:waitlist   (OUT=dir keeps screenshots)
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_URL ?? "http://localhost:3111";
const OUT = process.env.OUT ?? "e2e/.waitlist-out";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

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

for (const [width, height] of [[1440, 900], [390, 844]]) {
  const mode = `[${width}px]`;
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await open(ctx, mode);
  await page.screenshot({ path: `${OUT}/${width}.png` });

  if ((await page.locator("h1").count()) !== 1) fail(mode, "expected exactly one h1");
  if (!(await page.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily)).includes("Geist")) fail(mode, "h1 is not Geist");
  const body = await page.evaluate(() => document.body.innerText);
  if (/—/.test(body)) fail(mode, "em dash in page text");
  if (/framer|qarin|builders already/i.test(body)) fail(mode, "reference branding or invented social proof in page text");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail(mode, "horizontal scroll");
  if (!(await page.getByLabel("Email address").isVisible())) fail(mode, "email field not visible");
  if (await page.getByRole("link", { name: /sign in/i }).count()) fail(mode, "sign-in link is back");

  await page.evaluate(axeSource);
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  for (const v of result.violations.filter((x) => ["serious", "critical"].includes(x.impact)))
    fail(mode, `axe ${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`);
  await ctx.close();
}

// Form states, with the API mocked: empty submit never calls it, a server error shows a message, success replaces the form.
{
  const mode = "[form]";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await open(ctx, mode);
  let hits = 0;
  let status = 500;
  await page.route("**/api/waitlist", (r) => { hits++; return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(status === 200 ? { ok: true } : { ok: false, reason: "server" }) }); });
  const submit = page.getByRole("button", { name: "Join waitlist" });
  const error = page.locator("#waitlist-error");

  await submit.click();
  if (!/doesn't look right/.test(await error.innerText())) fail(mode, "empty submit shows no invalid message");
  if (hits) fail(mode, "empty submit called the API");

  await page.getByLabel("Email address").fill("owner@example.com");
  await submit.click();
  await page.waitForFunction(() => /couldn't save/.test(document.querySelector("#waitlist-error")?.textContent ?? "")).catch(() => fail(mode, "server error shows no message"));
  await page.screenshot({ path: `${OUT}/form-error.png` });

  status = 200;
  await submit.click();
  await page.getByText("You're on the list.").waitFor({ timeout: 5000 }).catch(() => fail(mode, "success state not shown"));
  await page.screenshot({ path: `${OUT}/form-success.png` });
  if (hits !== 2) fail(mode, `expected 2 API calls, saw ${hits}`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`waitlist: ${failures.length} problem(s)\n` + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log("waitlist: OK");
