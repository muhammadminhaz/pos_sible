import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { SignedInRedirect, WaitlistForm } from "./interactive";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** Pre-launch waitlist page shown on `/` until the landing page (features/landing) is designed: one dark screen, the email form is the only call to action. */
export function Waitlist() {
  return (
    <div lang="en" className={cn(geist.variable, mono.variable, "wl-root relative isolate min-h-dvh overflow-hidden bg-[#05050a] text-white")}>
      <SignedInRedirect />
      <Ribbons />

      <header className="relative z-10 px-4 pt-4 sm:pt-6">
        <nav aria-label="Main" className="wl-glass wl-rise mx-auto flex h-14 max-w-4xl items-center justify-between rounded-2xl pr-2 pl-3 sm:h-16 sm:pl-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg font-display text-[15px] font-medium tracking-tight">
            <Image src="/logo-192.png" alt="" width={28} height={28} className="rounded-[22%]" priority />
            {SITE.name}
          </Link>
          <a href="#waitlist" className="group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10">
            Join waitlist
            <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </nav>
      </header>

      <main id="main" className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] max-w-4xl flex-col items-center justify-center px-4 pt-10 pb-20 text-center">
        <div className="wl-rise wl-tile" style={delay(80)}>
          <Image src="/logo-192.png" alt="" width={56} height={56} className="rounded-[22%]" />
        </div>

        <p className="wl-rise wl-glass mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[13px] text-white/85" style={delay(160)}>
          <span aria-hidden className="wl-pulse size-1.5 rounded-full bg-emerald-400" />
          Early access: opening soon
        </p>

        <h1 className="wl-rise mt-7 font-display text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-7xl" style={delay(240)}>
          <span className="wl-ink-1">Get early access.</span>
          <br />
          <span className="wl-ink-2">Join the waitlist today.</span>
        </h1>

        <p className="wl-rise mt-6 max-w-md text-[15px] leading-relaxed text-pretty text-white/70 sm:text-base" style={delay(320)}>
          {SITE.name} is more than a POS. It adds an intelligence layer on top of your business data that drives your decisions: what to restock, who to win back, which dues to collect. Be among the first shops to grow with it.
        </p>

        <div id="waitlist" className="wl-rise mt-9 w-full max-w-md scroll-mt-32" style={delay(400)}>
          <WaitlistForm />
        </div>
      </main>
    </div>
  );
}

/** Silk-like light ribbons: wide blurred strokes for the glow, hairlines for the bright edge. Decorative only. */
function Ribbons() {
  const left = ["M-260 -80 C 120 220 260 620 60 1000", "M-40 -80 C 330 260 470 660 300 1000"];
  const right = ["M1720 -80 C 1210 140 1170 560 1640 1000", "M1500 -80 C 1080 200 1060 520 1300 1000", "M980 1000 C 1150 720 1380 640 1720 560"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <svg className="absolute inset-0 size-full" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wl-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c7d2fe" />
            <stop offset="0.35" stopColor="#6366f1" />
            <stop offset="0.8" stopColor="#3730a3" />
            <stop offset="1" stopColor="#05050a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wl-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#a5b4fc" stopOpacity="0.7" />
            <stop offset="1" stopColor="#a5b4fc" stopOpacity="0" />
          </linearGradient>
          <filter id="wl-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26" /></filter>
        </defs>
        <g className="wl-sway-a">
          {left.map((d) => (
            <g key={d}>
              <path d={d} fill="none" stroke="url(#wl-band)" strokeWidth="150" opacity="0.55" filter="url(#wl-soft)" />
              <path d={d} fill="none" stroke="url(#wl-edge)" strokeWidth="2" transform="translate(70 0)" />
            </g>
          ))}
        </g>
        <g className="wl-sway-b">
          {right.map((d) => (
            <g key={d}>
              <path d={d} fill="none" stroke="url(#wl-band)" strokeWidth="170" opacity="0.5" filter="url(#wl-soft)" />
              <path d={d} fill="none" stroke="url(#wl-edge)" strokeWidth="2" transform="translate(-74 0)" />
            </g>
          ))}
        </g>
      </svg>
      <div className="wl-vignette absolute inset-0" />
      <div className="wl-grain absolute inset-0" />
    </div>
  );
}
