import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { ArrowUpRightIcon, StoreIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import content from "@/features/landing/content.json";
import dashboard from "@/public/welcome/dashboard.png";
import StarBorder from "@/components/ui/star-border";
import { TiltBackground } from "./TiltBackground";
import { WelcomeNav } from "./WelcomeNav";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: "500", style: "italic", variable: "--font-serif", display: "swap" });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const hero = content.sections.find((s) => s.id === "hero")!;
// Same rule as the login page: signup only exists when the deployment allows it, otherwise new visitors try the demo.
const getStarted = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true" ? "/signup" : "/login";

/** Hero for the coming landing page. Lives on /welcome until it replaces the waitlist on `/`. Nav anchors point at sections still to be built. */
export function Welcome() {
  return (
    <div lang="en" className={cn(geist.variable, mono.variable, serif.variable, "wl-root h-dvh bg-[#05050a] p-2 sm:p-4")}>
      {/* The dark frame is a bezel: the page scrolls inside the card, under a notch that hangs from its top edge. */}
      <div className="relative isolate h-full overflow-hidden rounded-[28px] text-white">
        <TiltBackground />
        {/* overflow-y alone would let it scroll sideways too; the hero also clips the Get started glow, which reaches 48px past the button. */}
        <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {/* Fixed height: the nav floats in it, so the phone menu unfolds over the hero instead of pushing it down. */}
        <header className="sticky top-0 z-20 h-16 sm:h-[68px]">
          <WelcomeNav links={content.nav} />
        </header>

        <main id="main" className="mx-auto flex w-full max-w-5xl flex-col overflow-x-clip items-start px-5 pt-10 text-left sm:items-center sm:px-4 sm:pt-20 sm:text-center">
          <p className="wl-rise rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[13px] ring-1 ring-white/25 backdrop-blur-sm" style={delay(80)}>
            {hero.badge}
          </p>

          <h1 className="wl-rise mt-6 pb-1 font-display text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.25rem]" style={delay(160)}>
            <span className="lg:whitespace-nowrap">It doesn&apos;t just run your shop.</span>
            <br />
            <span className="font-[family-name:var(--font-serif)] text-[1.12em] leading-[1.1] font-medium tracking-[-0.02em] text-[#d8ecff] italic">It understands it.</span>
          </h1>

          <p className="wl-rise mt-5 max-w-2xl text-[15px] leading-relaxed text-pretty text-white sm:text-lg" style={delay(240)}>
            The all-in-one POS with an intelligence layer that reads every sale, stock count and due, then guides you on what to restock, who to win back and which dues to collect.
          </p>

          <div className="wl-rise mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center" style={delay(320)}>
            <StarBorder as="a" href={getStarted} radius={24} color="#9fd0ff" glow={0.9} sparkle backgroundColor="#05050a" className="group h-12 w-full justify-between gap-3 py-0 pr-1.5 pl-6 sm:w-auto text-[15px] font-semibold shadow-[0_12px_40px_-12px_rgb(5_20_120/0.8)] active:scale-[0.98]">
              Get started
              <ArrowSwap className="size-9 bg-white text-[#0a3cff]" />
            </StarBorder>
            <Link href="/demo" className="group inline-flex h-12 w-full items-center justify-center gap-2.5 sm:w-auto sm:justify-start rounded-full bg-white pr-6 pl-1.5 text-[15px] font-semibold text-[#05050a] shadow-[0_12px_40px_-12px_rgb(5_20_120/0.5)] transition-[transform,background-color] hover:bg-[#eaf3ff] active:scale-[0.98]">
              <LiveBars />
              See demo
            </Link>
          </div>
        </main>

        {/* The whole screenshot shows, fading into the card at the bottom. */}
        <div className="wl-rise mx-auto mt-auto w-full max-w-5xl px-3 pt-12 [mask-image:linear-gradient(to_bottom,black_60%,transparent)] sm:px-8 sm:pt-16" style={delay(440)}>
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

        <TrustedClients />
        </div>
      </div>
    </div>
  );
}

const SLOTS = 6;

/**
 * Where client logos will loop once shops sign up. Until then the loop holds open "Your shop here" slots
 * and the line invites the first ones in. Sits on the pale haze at the bottom of the card, so it uses dark ink.
 */
function TrustedClients() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 gap-3 pr-3">
      {Array.from({ length: SLOTS }, (_, i) => (
        <li key={i} className="flex h-11 items-center gap-2 rounded-full border border-dashed border-[#0a3cff]/30 bg-white/50 px-4 text-sm font-medium whitespace-nowrap text-[#0a3cff] backdrop-blur-sm">
          <StoreIcon aria-hidden className="size-4" />
          Your shop here
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-labelledby="clients-title" className="relative -mt-4 px-5 pb-10 text-[#071447] sm:-mt-6 sm:pb-14">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-1.5 sm:items-center sm:text-center">
        <h2 id="clients-title" className="font-display text-sm font-medium text-[#071447]/70">Trusted clients</h2>
        <p className="text-lg font-semibold tracking-tight text-pretty sm:text-xl">
          Coming soon.{" "}
          <Link href={getStarted} className="underline decoration-[#0a3cff]/40 underline-offset-4 transition-colors hover:text-[#0a3cff] hover:decoration-[#0a3cff]">
            Become our first user
          </Link>
        </p>
      </div>
      <div className="mx-auto mt-6 flex max-w-5xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="wl-marquee flex">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}

/** Arrow in a circle; on hover of the parent `group` it flies out to the top right and a fresh one slides in from the bottom left. */
function ArrowSwap({ className }: { className: string }) {
  const move = "absolute size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full", className)}>
      <ArrowUpRightIcon className={cn(move, "group-hover:translate-x-5 group-hover:-translate-y-5")} />
      <ArrowUpRightIcon className={cn(move, "-translate-x-5 translate-y-5 group-hover:translate-x-0 group-hover:translate-y-0")} />
    </span>
  );
}

/** Three bars that rise and fall like a live chart: a gentle idle pulse, a staggered bounce on hover. Stands for "real data inside". */
function LiveBars() {
  return (
    <span aria-hidden className="flex size-9 items-end justify-center gap-[3px] rounded-full bg-[#0a3cff]/10 pb-[11px] transition-colors duration-300 group-hover:bg-[#0a3cff]">
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
