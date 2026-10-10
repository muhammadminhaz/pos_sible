import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import {
  ArrowUpRightIcon,
  BellRingIcon,
  BookOpenIcon,
  ChevronDownIcon,
  CreditCardIcon,
  LandmarkIcon,
  LanguagesIcon,
  LayersIcon,
  ReceiptTextIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TagIcon,
  TruckIcon,
  CheckIcon,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BENTO, BRAND, CTA, FAQ, FEATURES, FOOTER, GET_STARTED_HREF, GROWTH, HERO, HOW, NAV, PAYMENTS, POSSIBLE, PRICING, SHOPS, STATS, TOUR, VISIBILITY,
} from "./content";
import { GrowthTabs, PricingPlans, Reveal, SignedInRedirect, StatCount } from "./interactive";
import { CartMock, DashboardMock, DonutMock, ForecastMock, ImportMock, ReceiptMock, SalesLineMock, StockMock, TourTile } from "./mockups";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

const ICONS: Record<string, LucideIcon> = {
  truck: TruckIcon, receipt: ReceiptTextIcon, landmark: LandmarkIcon, shield: ShieldCheckIcon, bell: BellRingIcon, languages: LanguagesIcon,
};

const wrap = "mx-auto w-full max-w-[1296px] px-4 sm:px-6";
const section = "py-20 lg:py-28";
const card = "rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04),0_12px_32px_-16px_rgb(11_12_43/.18)]";
const h2 = "font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] lg:text-5xl";
const lead = "text-[0.9375rem] leading-relaxed text-muted-foreground lg:text-base";
const pillBtn = "h-12 rounded-xl px-6 text-[0.9375rem]";

function Eyebrow({ icon: Icon, children, light }: { icon: LucideIcon; children: ReactNode; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full p-1 pr-3 text-[0.8125rem] font-medium", light ? "bg-white/15 text-white" : "bg-card text-foreground ring-1 ring-border")}>
      <span className={cn("grid size-6 place-items-center rounded-full", light ? "bg-white/20" : "bg-primary/10 text-primary")}>
        <Icon className="size-3.5" />
      </span>
      {children}
    </span>
  );
}

function Head({ id, eyebrow, icon, title, body, light }: { id: string; eyebrow?: string; icon?: LucideIcon; title: string; body?: string; light?: boolean }) {
  return (
    <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
      {eyebrow && icon && <Eyebrow icon={icon} light={light}>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn(h2, light && "text-white")}>{title}</h2>
      {body && <p className={cn(lead, light && "text-white/80")}>{body}</p>}
    </Reveal>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-display text-lg font-semibold tracking-tight", className)}>
      <Image src="/icon.svg" alt="" width={28} height={28} className="size-7 rounded-lg" />
      {BRAND}
    </span>
  );
}

function Nav() {
  return (
    <header className="sticky top-4 z-40 px-4">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-[1100px] items-center justify-between rounded-full border bg-background/95 pl-5 pr-2 shadow-[0_8px_30px_-12px_rgb(11_12_43/.25)] backdrop-blur-md"
      >
        <Link href="/" aria-label={`${BRAND} home`}><Logo /></Link>
        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{n.label}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "hidden rounded-full sm:inline-flex")}>Sign in</Link>
          <Link href={GET_STARTED_HREF} className={cn(buttonVariants(), "rounded-full px-5")}>Get started</Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="hero" aria-labelledby="hero-title" className="pb-8 pt-16 lg:pt-24">
      <div className={cn(wrap, "flex flex-col items-center text-center")}>
        <div className="flex flex-col items-center gap-6">
          <Eyebrow icon={SparklesIcon}>{HERO.badge}</Eyebrow>
          <h1 id="hero-title" className="font-display max-w-4xl text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[3.25rem] lg:text-[4rem]">
            {HERO.title}
          </h1>
          <p className={cn(lead, "max-w-xl")}>{HERO.body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={GET_STARTED_HREF} className={cn(buttonVariants(), pillBtn)}>{HERO.primary}</Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), pillBtn, "gap-2")}>{HERO.secondary} <ArrowUpRightIcon className="size-4" /></Link>
          </div>
        </div>
      </div>
      <div className={cn(wrap, "mt-14")}>
        <div className="bg-stripes-fade rounded-[28px] px-3 pt-8 sm:px-10 sm:pt-12">
          <div className="mx-auto max-w-[1040px] rounded-t-[24px] bg-white/30 p-2 pb-0 shadow-2xl shadow-primary/25 dark:bg-white/10 sm:p-3 sm:pb-0">
            <DashboardMock />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">{HERO.trust}</p>
      </div>
    </section>
  );
}

function Product() {
  const mocks = [<CartMock key="c" />, <StockMock key="s" />, <SalesLineMock key="l" />];
  return (
    <section id="product" aria-labelledby="product-title" className={section}>
      <div className={wrap}>
        <Head id="product-title" eyebrow={BENTO.eyebrow} icon={LayersIcon} title={BENTO.title} body={BENTO.body} />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {BENTO.cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className={cn(card, "landing-lift flex h-full flex-col gap-6 p-5 hover:border-primary/40")}>
                <div className="grid min-h-[200px] place-items-center rounded-xl bg-muted/60 p-4">
                  <div className="w-full">{mocks[i]}</div>
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">{c.title}</h3>
                  <p className={cn(lead, "mt-2")}>{c.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section id="stats" aria-label="POS-sible at a glance" className="py-4">
      <div className={wrap}>
        <Reveal>
          <dl className="bg-panel grid grid-cols-2 gap-y-8 rounded-[28px] p-8 text-white lg:grid-cols-4 lg:p-10">
            {STATS.map((s, i) => (
              <div key={s.label} className={cn("flex flex-col-reverse gap-3 px-2 lg:px-8", i > 0 && "lg:border-l lg:border-dashed lg:border-white/25")}>
                <dt className="text-sm leading-relaxed text-white/85 lg:text-base">{s.label}</dt>
                <dd className="font-display text-5xl font-semibold tracking-[-0.04em] lg:text-6xl"><StatCount value={s.value} />{s.suffix}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function Visibility() {
  return (
    <section id="visibility" aria-labelledby="visibility-title" className={section}>
      <div className={cn(wrap, "grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]")}>
        <Reveal className="flex flex-col gap-5">
          <h2 id="visibility-title" className={h2}>{VISIBILITY.title}</h2>
          <p className={lead}>{VISIBILITY.body}</p>
          <ul className="mt-2 divide-y">
            {VISIBILITY.points.map((p) => (
              <li key={p} className="flex items-center gap-3 py-4 text-[0.9375rem] font-medium first:pt-0">
                <CheckIcon className="size-4 shrink-0 text-primary" /> {p}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="grid gap-4 sm:grid-cols-[0.9fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className={cn(card, "grid flex-1 place-items-center bg-muted/60 p-5")}><ReceiptMock /></div>
            <div className="bg-panel rounded-2xl p-5 text-white">
              <p className="font-display text-xl font-semibold">{VISIBILITY.statTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{VISIBILITY.statBody}</p>
            </div>
          </div>
          <div className="bg-stripes rounded-2xl p-4 pt-10">
            <div className="rounded-xl bg-background p-5 shadow-xl">
              <p className="font-display mb-4 text-lg font-semibold">{VISIBILITY.donutTitle}</p>
              <DonutMock />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Growth() {
  return (
    <section id="growth" aria-labelledby="growth-title" className="py-4">
      <div className={wrap}>
        <div className="bg-stripes rounded-[28px] px-4 py-16 sm:px-10 lg:py-20">
          <Head id="growth-title" eyebrow={GROWTH.eyebrow} icon={RocketIcon} title={GROWTH.title} body={GROWTH.body} light />
          <Reveal delay={0.1} className="mx-auto mt-12 max-w-[920px]"><GrowthTabs /></Reveal>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className={section}>
      <div className={wrap}>
        <div className="rounded-[28px] bg-zinc-950 px-4 py-16 text-zinc-50 dark:ring-1 dark:ring-border sm:px-10 lg:py-24">
          <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 p-1 pr-3 text-[0.8125rem] font-medium">
              <span className="grid size-6 place-items-center rounded-full bg-white/15"><TagIcon className="size-3.5" /></span>{FEATURES.eyebrow}
            </span>
            <h2 id="features-title" className={h2}>{FEATURES.title}</h2>
            <p className="text-[0.9375rem] leading-relaxed text-zinc-300 lg:text-base">{FEATURES.body}</p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.items.map((f, i) => {
              const Icon = ICONS[f.icon];
              return (
                <Reveal key={f.title} delay={(i % 3) * 0.06}>
                  <div className="landing-lift h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/30 hover:bg-white/[0.06]">
                    <Icon className="size-9 stroke-[1.25]" aria-hidden />
                    <h3 className="font-display mt-10 text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-zinc-300">{f.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Possible() {
  const [first, ...rest] = POSSIBLE.items;
  return (
    <section id="possible" aria-labelledby="possible-title" className="pb-20 lg:pb-28">
      <div className={wrap}>
        <Head id="possible-title" eyebrow={POSSIBLE.eyebrow} icon={SparklesIcon} title={POSSIBLE.title} body={POSSIBLE.body} />
        <div className="mt-14 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <Reveal className="lg:row-span-2">
            <div className={cn(card, "landing-lift flex h-full flex-col justify-between gap-8 p-6 hover:border-primary/40")}>
              <div className="rounded-xl bg-muted/60 p-5"><ForecastMock /></div>
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight">{first.title}</h3>
                <p className={cn(lead, "mt-2 max-w-md")}>{first.body}</p>
              </div>
            </div>
          </Reveal>
          {rest.map((p, i) => (
            <Reveal key={p.title} delay={(i + 1) * 0.08}>
              <div className={cn(card, "landing-lift h-full p-6 hover:border-primary/40")}>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">{i === 0 ? <TruckIcon className="size-5" /> : <CreditCardIcon className="size-5" />}</span>
                <h3 className="font-display mt-6 text-xl font-semibold tracking-tight">{p.title}</h3>
                <p className={cn(lead, "mt-2")}>{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function How() {
  const mocks = [<ImportMock key="i" />, <CartMock key="c" />, <ForecastMock key="f" />];
  return (
    <section id="how" aria-labelledby="how-title" className="py-4 lg:py-8">
      <div className={wrap}>
        <Head id="how-title" eyebrow={HOW.eyebrow} icon={BookOpenIcon} title={HOW.title} body={HOW.body} />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {HOW.steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="landing-lift flex h-full flex-col gap-6 rounded-2xl bg-muted/60 p-5 hover:shadow-lg">
                <div className="flex-1">{mocks[i]}</div>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className={cn(lead, "mt-2")}>{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Shops() {
  return (
    <section id="shops" aria-labelledby="shops-title" className={section}>
      <div className={wrap}>
        <Head id="shops-title" title={SHOPS.title} body={SHOPS.body} />
        <div className="mt-14 space-y-5">
          {SHOPS.items.map((s, i) => (
            <div key={s.kind} className="lg:sticky" style={{ top: `${96 + i * 24}px` }}>
              <article className={cn(card, "grid gap-8 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-8")}>
                <div className="flex flex-col justify-between gap-8">
                  <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Example: {s.kind}</span>
                  <p className="font-display text-2xl font-medium leading-snug tracking-tight lg:text-[1.75rem]">{s.title}</p>
                </div>
                <ul className="space-y-3 rounded-xl bg-muted/60 p-5 text-[0.9375rem]">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5"><CheckIcon className="size-4 shrink-0 text-primary" /> {p}</li>
                  ))}
                </ul>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Payments() {
  return (
    <section id="payments" aria-labelledby="payments-title" className="pb-20 lg:pb-28">
      <div className={wrap}>
        <Head id="payments-title" eyebrow={PAYMENTS.eyebrow} icon={CreditCardIcon} title={PAYMENTS.title} body={PAYMENTS.body} />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAYMENTS.items.map((p, i) => (
            <li key={p.name}>
              <Reveal delay={(i % 4) * 0.05}>
                <div className={cn(card, "landing-lift flex items-center justify-between gap-3 p-4 hover:border-primary/40")}>
                  <span className="flex items-center gap-3 text-[0.9375rem] font-medium">
                    <span className={cn("size-3 shrink-0 rounded-full", p.dot)} aria-hidden />{p.name}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Built in</span>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-4">
      <div className={wrap}>
        <div className="bg-stripes rounded-[28px] px-4 py-16 sm:px-10 lg:py-20">
          <Head id="pricing-title" eyebrow={PRICING.eyebrow} icon={TagIcon} title={PRICING.title} light />
          <Reveal delay={0.1} className="mt-10"><PricingPlans /></Reveal>
          <p className="mt-8 text-center text-sm text-white/85">{PRICING.note}</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={section}>
      <div className={cn(wrap, "grid gap-12 lg:grid-cols-[1fr_1.4fr]")}>
        <Reveal className="flex flex-col items-start gap-4">
          <h2 id="faq-title" className={h2}>{FAQ.title}</h2>
          <p className={lead}>{FAQ.body}</p>
        </Reveal>
        <div className="space-y-3">
          {FAQ.items.map((f) => (
            <details key={f.q} name="faq" className={cn(card, "group px-5 open:border-primary/40")}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[0.9375rem] font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className={cn(lead, "pb-5")}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tour() {
  return (
    <section id="tour" aria-labelledby="tour-title" className="pb-20 lg:pb-28">
      <div className={wrap}>
        <Head id="tour-title" eyebrow={TOUR.eyebrow} icon={BookOpenIcon} title={TOUR.title} />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {TOUR.cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <Link href="/login" className={cn(card, "landing-lift group block h-full p-4 hover:border-primary/40")}>
                <div className="relative h-52 overflow-hidden rounded-xl">
                  <div className="h-full transition-[filter] duration-300 group-hover:blur-[3px] motion-reduce:transition-none"><TourTile kind={i as 0 | 1 | 2} /></div>
                  <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 scale-75 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                    <ArrowUpRightIcon className="size-5" aria-hidden />
                  </span>
                </div>
                <div className="p-3 pt-6">
                  <h3 className="font-display text-xl font-semibold tracking-tight">{c.title}</h3>
                  <p className={cn(lead, "mt-2")}>{c.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-[0.9375rem] font-medium text-primary">Try it in the demo <ArrowUpRightIcon className="size-4" aria-hidden /></span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section id="cta" aria-labelledby="cta-title" className="py-4">
      <div className={wrap}>
        <Reveal>
          <div className="bg-stripes flex flex-col items-center gap-5 rounded-[28px] px-6 py-20 text-center text-white lg:py-28">
            <h2 id="cta-title" className={cn(h2, "max-w-2xl text-white")}>{CTA.title}</h2>
            <p className="text-white/85">{CTA.body}</p>
            <Link href={GET_STARTED_HREF} className={cn(buttonVariants({ variant: "secondary" }), pillBtn, "mt-2 bg-white text-zinc-900 hover:bg-white/90")}>{CTA.action}</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="footer" className="pb-10 pt-20 lg:pt-28">
      <div className={wrap}>
        <div className="flex flex-col justify-between gap-6 border-b pb-10 lg:flex-row lg:items-end">
          <p aria-hidden data-word={BRAND} className="font-display select-none text-[22vw] font-bold leading-[0.8] tracking-[-0.06em] text-muted before:content-[attr(data-word)] lg:text-[190px]" />
          <p className="text-sm text-muted-foreground lg:text-right">All rights reserved.<br />© {new Date().getFullYear()} {BRAND}</p>
        </div>
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{FOOTER.blurb}</p>
          </div>
          {FOOTER.columns.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="font-display text-sm font-semibold">{c.title}</p>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {c.links.map((l) => (
                  <li key={l.label}><Link href={l.href} className="transition-colors hover:text-foreground">{l.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div lang="en" className={cn(geist.variable, "min-h-dvh bg-background text-foreground")}>
      <SignedInRedirect />
      {/* Scroll reveals start hidden, so without JavaScript show everything. */}
      <noscript><style>{"[style*='opacity: 0']{opacity:1!important;transform:none!important}"}</style></noscript>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <Product />
        <Stats />
        <Visibility />
        <Growth />
        <Features />
        <Possible />
        <How />
        <Shops />
        <Payments />
        <Pricing />
        <Faq />
        <Tour />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
