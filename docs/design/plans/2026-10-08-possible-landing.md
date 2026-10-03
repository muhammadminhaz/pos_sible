# pos_sible: Landing Page Implementation Plan (sub-project 10)

**Goal:** a public landing page at `/` that sells the brand idea, not a feature list. POS-sible is software that makes a business more than a spreadsheet: it records the shop, finds the gaps, suggests what to do next, and learns from the shop's own data so the owner decides on price, demand and stock with confidence.

**Brand line:** "Everything your shop can become is possible."
**Tagline:** EN "Make it POS-sible" / BN "সব সম্ভব".
**Positioning:** other POS software records what happened. POS-sible shows what's possible next.

**Today:** `web/app/page.tsx` only redirects to `/home`. The sign-in screens (`app/(auth)/layout.tsx`) carry the only marketing copy ("Run your whole shop from one screen"). `sitemap.ts` lists `/login` as the top page.

**Order of work:** this plan first, then the Opportunities tab and the Goals tab (separate plans). The landing page shows those two as previews, so their copy must stay honest until they ship (see Task 7).

---

## Narrative (the page reads as one argument)

Each section answers the question the previous one raises. No numbered "1/2/3" steps, no feature-tile wall.

| # | Section | Job | Visual |
|---|---------|-----|--------|
| A | **Hero** | State the promise | Headline, sub, two CTAs, and a spreadsheet grid that resolves into insight chips as it settles |
| B | **"A spreadsheet only remembers"** | Name the pain | A plain ledger table of a week's sales. Nothing stands out, which is the point |
| C | **"POS-sible finds the gaps"** | Gaps | Same table, now annotated: a product about to run out, a slow mover tying up cash, a customer who stopped coming, a margin leak |
| D | **"…and says what's possible next"** | Opportunities | The **Possible card**: "৳12,400 more is possible this month if you restock Product X before Friday." Two or three cards cycle |
| E | **"Decide on price, demand and market"** | Decisions | Interactive what-if: slider for price change and discount, shows projected revenue, margin, units, using a fixed sample shop |
| F | **"It learns from your shop"** | Forecast | Sales line with a forecast band and a stock-out date marker |
| G | **"Set a dream. Watch it get closer."** | Goals | Goal ring toward "৳10 lakh monthly sales" and a milestone toast ("Possible unlocked: first ৳1 lakh day") |
| H | **"And yes, it runs the counter"** | Proof it's a full POS | Dense, quiet strip: barcode checkout, bKash/Nagad/card split payments, multi-location stock, purchases, expenses, accounts, reports, offline-friendly, EN/বাংলা |
| I | **Bangla-first** | Audience | Same Possible card shown in Bangla beside English, "from one stall to three branches" story |
| J | **FAQ** | Objections | Is my data private? Does it need internet? Can staff use it? Do I need to know analytics? What does it cost? |
| K | **Closing CTA + footer** | Convert | "Make it POS-sible" + Try with sample data / Create your shop |

**Voice:** encouraging business partner, "you can" language, plain words, Bangla first in BN locale. No em dashes anywhere in copy (repo rule). Real-looking numbers in ৳, never lorem ipsum.

## Visual system

- **Reuse** existing tokens in `app/globals.css` (indigo primary, zinc neutrals, Inter + Anek Bangla). The landing page is the same product, not a different brand.
- **One new token, `--possible`**, the confident accent used only for "possible" moments: opportunity values, milestone unlocks, the hyphen mark. Proposed: a bright lime `oklch(0.87 0.2 128)` on dark indigo surfaces, with `--possible-foreground` (`oklch(0.45 0.13 135)`) for text on light backgrounds. It must stay distinct from `--success` (emerald) and `--warning` (amber) so it reads as "opportunity", not "OK" or "alert". Rule: at most one `--possible` element visible per viewport.
- **Wordmark:** new `components/brand/Wordmark.tsx`. "POS" + hyphen + "sible", where the hyphen is an inline SVG forward arrow in `--possible`. On hero load the arrow draws in once (`stroke-dashoffset`). Reused later in the app header and the Possible card.
- **Anti-slop guardrails (user rules):** no grid backgrounds, no blurred circle backgrounds (the auth aside has them; do not copy that pattern here), no Bootstrap three-column tiles, no grey placeholder boxes. Depth comes from real UI fragments (tables, cards, charts) rendered with the app's own components.
- **Motion** with the installed `motion` package: scroll-linked reveal of table annotations (C), count-up on the Possible card value (reuse `lib/useCountUp.ts`), forecast band draw (F), ring fill (G). Everything honours `prefers-reduced-motion` (static end state).
- **Charts:** inline SVG, not Highcharts. Highcharts is heavy for a public first paint; the landing visuals are illustrations with fixed data. Reuse/extend `components/auth/HeroChart.tsx` if it fits.

## Architecture

```
web/app/
  page.tsx                      -> replaced: renders the landing page (server component)
  (marketing)/                  -> not needed: one page, keep it at app/page.tsx
web/features/landing/
  sections/Hero.tsx, Ledger.tsx, Gaps.tsx, Possible.tsx, WhatIf.tsx,
           Forecast.tsx, Goals.tsx, CounterProof.tsx, Bangla.tsx, Faq.tsx, Closing.tsx
  LandingNav.tsx                -> wordmark, LocaleToggle, ThemeToggle, Sign in, primary CTA
  SessionCta.tsx (client)       -> "Open your shop" when signed in, else "Try with sample data"
  sample.ts                     -> the fixed sample shop numbers every section uses
  whatIf.ts                     -> pure projection math for section E
  whatIf.test.ts
web/components/brand/Wordmark.tsx
```

- Every section is a **server component**; only `SessionCta`, `WhatIf`, and the motion wrappers are client islands. Copy comes from `getTranslations("landing")`.
- **Signed-in visitors:** no auto-redirect (the session lives client-side in `lib/auth/session.ts` / `authStore.ts`, so a server redirect is impossible in demo mode and a client redirect causes a flash). `SessionCta` swaps the CTA to "Open your shop" -> `/home`. While the session hydrates it shows a fixed-width skeleton button so nothing shifts.
- **One sample shop** in `sample.ts` feeds B through G so the story is consistent: the restocked product in D is the one running out in C and the one whose stock-out date shows in F.
- `whatIf.ts`: `project({ price, unitCost, units, elasticity, priceChangePct, discountPct }) => { revenue, profit, units, marginPct }`. A simple constant-elasticity model, labelled on the page as "an estimate from a sample shop". The real calculator later reuses this function with the shop's data.

## Tasks

### Task 1: Brand tokens and wordmark
Add `--possible` / `--possible-foreground` (light + dark) to `app/globals.css` and `@theme inline`. Build `components/brand/Wordmark.tsx` (sizes sm/md/lg, `animate` prop, `aria-label="POS-sible"`).
**Done when:** `npm run typecheck` passes; wordmark renders in light and dark; contrast of `--possible-foreground` on `--background` is at least 4.5:1 (check with axe).

### Task 2: Route and shell
Replace the redirect in `app/page.tsx` with the landing page. Add `LandingNav` (sticky, condenses on scroll) and footer. Keep `(app)` routes untouched. Update `lib/routes.ts` / `routes.test.ts` if they assert `/` redirects.
**Done when:** `GET /` returns 200 with the hero headline in the HTML (no client-only render), `/home` still requires sign-in, `npm test` passes.

### Task 3: Copy (EN + BN)
Add a `landing` namespace to `messages/en.json` and `messages/bn.json`. Draft headlines:
- Hero: EN "More than a spreadsheet. A partner that sees what's possible." / BN "শুধু হিসাবের খাতা নয়। আপনার ব্যবসার সম্ভাবনা দেখায়।"
- Hero sub: "POS-sible runs your counter, finds the gaps in your numbers, and tells you what to do next: what to restock, what to price, who to call back."
- CTAs: "Try with sample data" (signup with sample data) and "Create your shop".
BN copy gets a native read before release (flag in PR).
**Done when:** no key missing in either locale (existing i18n parity test, or add one), no em dash in `landing.*` values (`grep -c "—" messages/*.json` restricted to the namespace returns 0).

### Task 4: Sample shop and what-if math
`features/landing/sample.ts` and `whatIf.ts` with `whatIf.test.ts`: zero change returns the baseline; a 5% price rise with elasticity -1.2 lowers units and the result matches a hand-computed value; discount and price change compose; inputs are clamped (price change -30%..+30%, discount 0..50%).
**Done when:** `npx vitest run features/landing` passes.

### Task 5: Sections A to D (promise, pain, gaps, possible)
Hero with spreadsheet-to-insight visual and animated wordmark; Ledger table; Gaps annotations revealed on scroll; Possible cards with count-up value in `--possible`.
**Done when:** each section renders at 360px, 768px, 1280px with no horizontal page scroll; with reduced motion the final state shows immediately.

### Task 6: Sections E to G (decide, learn, goals)
`WhatIf` client island (two sliders, live numbers, `aria-live="polite"` summary). Forecast SVG with band and stock-out marker. Goals ring and milestone toast.
**Done when:** sliders work by keyboard (arrow keys move 1%), numbers update, screen reader announces the summary; Task 4 tests still pass.

### Task 7: Honesty for unbuilt features
Opportunities and Goals do not exist in the app yet. Until their tabs ship, sections D, E (beyond the sample), F and G carry a small "Coming soon" badge, driven by one constant in `features/landing/sample.ts` (`SHIPPED = { opportunities: false, goals: false, forecast: false }`). Gaps (C) maps to the existing Analytics plan; badge it too unless Analytics has shipped.
**Done when:** flipping a flag removes its badge; no page copy claims a capability the app lacks.

### Task 8: Sections H to K (proof, Bangla, FAQ, close)
CounterProof strip lists only features that exist today (check against README status table). FAQ uses native `<details>`. Closing CTA reuses `SessionCta`.
**Done when:** every item in H links to or is listed in README as shipped.

### Task 9: SEO and sharing
Update `lib/site.ts` tagline and description to the new positioning (and `keywords`: "business analytics", "sales forecast", "inventory forecast", "Bangla business software"). Add `/` to `sitemap.ts` with priority 1, lower `/login`. Refresh `opengraph-image.tsx` / `twitter-image.tsx` with the wordmark and hero line. Page `metadata` with canonical `/`.
**Done when:** `npm run build` passes; `/sitemap.xml` lists `/`; OG image renders at `/opengraph-image`.

### Task 10: Auth screen alignment
Update `auth.heroTitle`, `heroBody`, `heroPoint*` to echo the landing message, and drop the blurred circles in `app/(auth)/layout.tsx` for the wordmark arrow motif.
**Done when:** login and signup show the new copy in EN and BN.

### Task 11: Verification
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass
- [ ] New `e2e/landing.mjs` (playwright-core, same pattern as `e2e/smoke.mjs`): loads `/` in EN and BN, light and dark, at 360px and 1280px; runs axe-core with zero serious violations; checks no horizontal scroll; clicks "Try with sample data" and lands on signup; signed-in session sees "Open your shop"
- [ ] Lighthouse on `npm run start`: Performance at least 90 mobile, LCP under 2.5s, CLS under 0.05
- [ ] README: landing page section (route, sections, `SHIPPED` flags, how to edit copy); `Product.md` positioning updated

## States

The page is static, so the four states apply to its live parts:
- **Loading:** `SessionCta` shows a skeleton button of final width while the session hydrates.
- **Success:** normal page; signed-in visitors get "Open your shop".
- **Empty:** not applicable to marketing content; the what-if starts at the baseline with a hint "Move a slider to see what's possible".
- **Error:** if session hydration throws, `SessionCta` falls back to the signed-out CTAs (never blocks the page). The global `not-found.tsx` stays as is.

## Out of scope

Pricing page, blog, customer testimonials (none real yet; do not invent them), analytics tracking, "Made possible" receipt footer and QR (belongs to the receipts work), impossible-to-possible onboarding (belongs to the onboarding feature).

## Review Focus

- Copy never promises an unshipped feature without the badge.
- `--possible` stays rare: one per viewport, never on errors or plain success.
- Public page ships minimal JS: sections are server components, no Highcharts on `/`.
- EN and BN tell the same story with the same sample numbers.
