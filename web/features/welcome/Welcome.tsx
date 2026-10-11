import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import dashboard from "@/public/welcome/dashboard.png";
import StarBorder from "@/components/ui/star-border";
import { TiltBackground } from "./TiltBackground";
import { LandingShell } from "./LandingShell";
import { Features, Squircle } from "./Features";
import { ClientStack } from "./ClientStack";
import { ArrowSwap, SiteFooter } from "./SiteFooter";
import { getStarted } from "@/lib/site";
import { Faq, PricingPlans, WhyChoose } from "./Sections";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** The public landing page, served at `/`. */
export function Welcome() {
  return (
    <LandingShell home backdrop={<TiltBackground />}>
        {/* The hero clips the Get started glow, which reaches 48px past the button. */}
        <main id="main" data-hero className="mx-auto flex w-full max-w-5xl flex-col overflow-x-clip items-start px-5 pt-24 text-left sm:items-center sm:px-4 sm:pt-36 sm:text-center lg:pt-44">
          <h1 className="wl-rise pb-1 font-display text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-7xl lg:text-[4.25rem] xl:text-[5.25rem]" style={delay(160)}>
            <span className="lg:whitespace-nowrap">It doesn&apos;t just run your shop.</span>
            <br />
            <span className="font-[family-name:var(--font-serif)] text-[1.12em] leading-[1.1] font-medium tracking-[-0.02em] text-[#d8ecff] italic">It understands it.</span>
          </h1>

          <p className="wl-rise mt-5 max-w-2xl text-[15px] leading-relaxed text-pretty text-white/90 sm:mt-7 sm:text-xl" style={delay(240)}>
            The POS that reads your sales and tells you what to do next.
          </p>

          <div className="wl-rise mt-8 flex w-full items-center gap-2.5 sm:mt-10 sm:w-auto sm:gap-3" style={delay(320)}>
            <StarBorder as="a" href={getStarted} radius={24} color="#9fd0ff" glow={0.9} sparkle backgroundColor="#05050a" className="group h-12 min-w-0 flex-1 justify-between gap-2 py-0 pr-1.5 pl-2 text-sm sm:flex-none sm:gap-3 sm:pl-6 sm:text-[15px] font-semibold shadow-[0_12px_40px_-12px_rgb(5_20_120/0.8)] active:scale-[0.98]">
              <span className="flex-1 text-center sm:flex-none">Get started</span>
              <ArrowSwap className="size-9 bg-white text-[#0a3cff]" />
            </StarBorder>
            <Link href="/demo" className="group inline-flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pr-2 pl-1.5 text-sm sm:flex-none sm:gap-2.5 sm:pr-6 sm:text-[15px] font-semibold text-[#05050a] shadow-[0_12px_40px_-12px_rgb(5_20_120/0.5)] transition-[transform,background-color] hover:bg-[#eaf3ff] active:scale-[0.98]">
              <LiveBars />
              <span className="flex-1 text-center sm:flex-none">See demo</span>
            </Link>
          </div>
        </main>

        {/* The whole screenshot shows, fading into the card at the bottom. */}
        <div className="wl-rise mx-auto mt-auto w-full max-w-5xl px-3 pt-12 [mask-image:linear-gradient(to_bottom,black_60%,transparent)] sm:px-8 sm:pt-24 lg:pt-28" style={delay(440)}>
          <div className="rounded-t-2xl bg-white/30 p-1.5 pb-0 shadow-[0_-20px_80px_-20px_rgb(5_20_120/0.35)] ring-1 ring-white/60 backdrop-blur-md sm:p-2.5 sm:pb-0">
            <div aria-hidden className="flex gap-1.5 px-2 pb-2 sm:pb-2.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57] ring-1 ring-black/10" />
              <span className="size-2.5 rounded-full bg-[#febc2e] ring-1 ring-black/10" />
              <span className="size-2.5 rounded-full bg-[#28c840] ring-1 ring-black/10" />
            </div>
            <Image
              src={dashboard}
              alt="The POS-sible dashboard showing this month's sales, purchases, expenses, dues and top products"
              sizes="(min-width: 1088px) 1024px, 100vw"
              placeholder="blur"
              loading="eager"
              fetchPriority="high"
              className="rounded-t-lg"
            />
          </div>
        </div>

        {/* One pale sheet slides up over the backdrop, so everything after the hero reads dark on light; its rounded foot overlaps the footer. */}
        <div className="relative z-10 rounded-[28px] bg-[#f5f8ff] text-[#071447]">
          <TrustedClients />
          <Features />
          <WhyChoose />
          <PricingPlans />
          <Faq />
        </div>
        <SiteFooter />
    </LandingShell>
  );
}

/** Where client logos will go once shops sign up. Until then a deck of open "founding shop" seats shuffles itself and invites the first ones in. */
function TrustedClients() {
  return (
    <section aria-labelledby="clients-title" className="border-b border-[#071447]/8 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-20">
        <div className="flex flex-col items-start">
          <p className="flex items-center gap-2 font-mono text-[13px] font-medium tracking-wide uppercase">
            <Squircle className="size-4" />
            Trusted clients
          </p>
          <h2 id="clients-title" className="mt-4 font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-[2.75rem]">
            Our customers will be featured here.{" "}
            <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#0a3cff] italic">Yours could be first.</span>
          </h2>
          <Link href={getStarted} className="group mt-7 inline-flex h-12 items-center gap-3 rounded-full bg-[#071447] pr-1.5 pl-6 text-[15px] font-semibold text-white transition-transform active:scale-[0.98]">
            Become our first user
            <ArrowSwap className="size-9 bg-white text-[#0a3cff]" />
          </Link>
        </div>
        <ClientStack />
      </div>
    </section>
  );
}

/** Three bars that rise and fall like a live chart: a gentle idle pulse, a staggered bounce on hover. Stands for "real data inside". */
function LiveBars() {
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-end justify-center gap-[3px] rounded-full bg-[#0a3cff]/10 pb-[11px] transition-colors duration-300 group-hover:bg-[#0a3cff]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ "--i": i } as CSSProperties}
          className="demo-bar h-3.5 w-[3px] origin-bottom rounded-full bg-[#0a3cff] transition-colors duration-300 group-hover:bg-white"
        />
      ))}
    </span>
  );
}
