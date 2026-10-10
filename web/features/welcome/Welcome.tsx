import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { ArrowUpRightIcon, MailIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import content from "@/features/landing/content.json";
import dashboard from "@/public/welcome/dashboard.png";
import StarBorder from "@/components/ui/star-border";
import { TiltBackground } from "./TiltBackground";

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
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain [scrollbar-width:none]">
        <header className="sticky top-0 z-20 flex justify-center">
          <nav aria-label="Main" className="wl-drop relative flex w-[calc(100%-4rem)] max-w-4xl items-center justify-between gap-3 rounded-b-[28px] bg-[#05050a] p-2 sm:p-2.5">
            <NotchCorner side="left" />
            <NotchCorner side="right" />
            <Link href="/" className="flex h-12 shrink-0 items-center gap-2.5 rounded-full pr-3 pl-1.5 font-display text-[15px] font-semibold tracking-tight">
              <Image src="/logo-192.png" alt="" width={32} height={32} className="rounded-full" />
              {SITE.name}
            </Link>
            <ul className="absolute left-1/2 hidden h-12 -translate-x-1/2 items-stretch gap-1 py-1 lg:flex">
              {content.nav.map((n) => (
                <li key={n.href} className="flex">
                  <NavPill href={n.href} label={n.label} />
                </li>
              ))}
            </ul>
            {/* After React Bits' GlareHover: one soft streak of light crosses the pill on hover. */}
            <a href="#contact" className="group relative inline-flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-white px-5 text-sm font-semibold text-[#05050a] transition-transform active:scale-[0.98]">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgb(10_60_255/0.18),transparent)] transition-transform duration-700 ease-out group-hover:translate-x-[300%] motion-reduce:hidden" />
              <MailIcon aria-hidden className="size-4 text-[#0a3cff]" />
              Contact
            </a>
          </nav>
        </header>

        <main id="main" className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-14 text-center sm:pt-20">
          <p className="wl-rise rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[13px] ring-1 ring-white/25 backdrop-blur-sm" style={delay(80)}>
            {hero.badge}
          </p>

          <h1 className="wl-rise mt-6 pb-1 font-display text-[2rem] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.75rem]" style={delay(160)}>
            The POS that tells you
            <br />
            <span className="font-[family-name:var(--font-serif)] text-[1.12em] leading-[1.1] font-medium tracking-[-0.02em] text-[#d8ecff] italic">what to do next</span>
          </h1>

          <p className="wl-rise mt-5 max-w-xl text-[15px] leading-relaxed text-pretty text-white sm:text-lg" style={delay(240)}>
            Sell, track stock and collect dues in English or <span lang="bn">বাংলা</span>. Then POS-sible reads every sale and tells you what to restock, which regulars to win back and which dues to chase.
          </p>

          <div className="wl-rise mt-8 flex flex-col items-center gap-3 sm:flex-row" style={delay(320)}>
            <StarBorder as="a" href={getStarted} radius={24} color="#9fd0ff" glow={0.9} sparkle backgroundColor="#05050a" className="group h-12 gap-3 py-0 pr-1.5 pl-6 text-[15px] font-semibold shadow-[0_12px_40px_-12px_rgb(5_20_120/0.8)] active:scale-[0.98]">
              Get started
              <ArrowSwap className="size-9 bg-white text-[#0a3cff]" />
            </StarBorder>
            <Link href="/demo" className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white pr-6 pl-1.5 text-[15px] font-semibold text-[#05050a] shadow-[0_12px_40px_-12px_rgb(5_20_120/0.5)] transition-[transform,background-color] hover:bg-[#eaf3ff] active:scale-[0.98]">
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
        </div>
      </div>
    </div>
  );
}

/** Concave fillet that blends the notch into the bezel's top edge, as if both were cut from one piece. */
function NotchCorner({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-0 size-7",
        side === "left"
          ? "right-full bg-[radial-gradient(circle_at_0_100%,transparent_27.5px,#05050a_28px)]"
          : "left-full bg-[radial-gradient(circle_at_100%_100%,transparent_27.5px,#05050a_28px)]",
      )}
    />
  );
}

/** Nav link in the style of React Bits' PillNav: a dome rises from the bottom on hover while the label slides up and a dark copy slides in. CSS only. */
function NavPill({ href, label }: { href: string; label: string }) {
  const slide = "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
  return (
    <a href={href} className="group relative flex items-center overflow-hidden rounded-full px-4 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70">
      <span aria-hidden className={cn("absolute top-full left-1/2 aspect-square w-[160%] -translate-x-1/2 rounded-full bg-white", slide, "group-hover:-translate-y-[62%] group-focus-visible:-translate-y-[62%]")} />
      <span className="relative block">
        <span className={cn("block", slide, "group-hover:-translate-y-[160%] group-focus-visible:-translate-y-[160%]")}>{label}</span>
        <span aria-hidden className={cn("absolute inset-0 block translate-y-[160%] text-[#05050a]", slide, "group-hover:translate-y-0 group-focus-visible:translate-y-0")}>{label}</span>
      </span>
    </a>
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
