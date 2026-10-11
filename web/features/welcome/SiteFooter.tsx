import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE, contactHref, getStarted } from "@/lib/site";
import StarBorder from "@/components/ui/star-border";
import { Threads } from "./TiltBackground";
import { Wordmark } from "./Wordmark";


// ponytail: section links point at /welcome; switch them to / when the landing page replaces the waitlist.
const COLUMNS = [
  { title: "Product", links: [{ href: "/welcome", label: "Home" }, { href: "/welcome#features", label: "Features" }, { href: "/welcome#why", label: "Why POS-sible" }, { href: "/welcome#faq", label: "FAQ" }] },
  { title: "Get going", links: [{ href: "/demo", label: "Try the demo" }, { href: getStarted, label: "Get started" }, { href: "/login", label: "Sign in" }] },
  { title: "Connect", links: [{ href: contactHref({ topic: "call" }), label: "Book a call" }, { href: "/contact", label: "Contact Us" }, { href: contactHref({ topic: "support" }), label: "Support" }] },
];
const LEGAL = [{ href: "/privacy", label: "Privacy policy" }, { href: "/terms", label: "Terms of service" }];

/**
 * Contact Us lands here. Flat brand blue with the hero's threads: a centered call to action, the brand beside link columns, a legal bar, then the wordmark.
 * It tucks 32px under whatever sits above it, so a rounded sheet above (z-10) shows blue behind its corners, not the bezel.
 */
export function SiteFooter() {
  return (
    <footer id="contact" aria-labelledby="contact-title" className="relative isolate -mt-8 shrink-0 overflow-hidden bg-[#0a3cff] pt-8 text-white">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-70">
        <Threads />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Call to action, centered. */}
        <div className="flex flex-col items-center pt-20 pb-20 text-center sm:pt-28 sm:pb-24">
          <h2 id="contact-title" className="max-w-2xl font-display text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            Ready to hear what{" "}
            <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#d8ecff] italic">your sales are saying?</span>
          </h2>
          <p className="mt-5 max-w-md text-pretty text-white/80 sm:text-lg">Take a 20-minute call with us. We&apos;ll look at how your shop runs and show you what POS-sible would find in it.</p>
          <StarBorder as="a" href={contactHref({ topic: "call" })} radius={24} color="#9fd0ff" glow={0.9} backgroundColor="#05050a" className="group mt-8 h-12 justify-between gap-3 py-0 pr-1.5 pl-6 text-[15px] font-semibold active:scale-[0.98]">
            Book a discovery call
            <ArrowSwap className="size-9 bg-white text-[#0a3cff]" />
          </StarBorder>
          <Link href="/demo" className="mt-4 text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">or explore the demo first</Link>
        </div>

        {/* Brand on the left, link columns on the right. */}
        <div className="grid gap-12 border-t border-white/20 py-14 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link href="/welcome" aria-label={`${SITE.name} home`} className="inline-flex">
              <Image src="/logo-192.png" alt="" width={36} height={36} />
            </Link>
            <p className="mt-5 font-display text-lg font-semibold tracking-tight">The POS that thinks ahead.</p>
            <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-pretty text-white/70">Sales, stock, dues and accounts for retail shops in Bangladesh.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="font-mono text-xs tracking-wide text-white/60 uppercase">{col.title}</p>
                <ul className="mt-4 grid gap-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-[15px] text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/20 py-6 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <ul className="flex gap-6">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The name finishes the sentence: "...? Yes, it's POS-sible." Blue on a white haze that rises out of the footer's blue. */}
      <div className="bg-[linear-gradient(to_bottom,transparent,rgb(255_255_255/0.55)_45%,rgb(255_255_255/0.95))] pt-16 sm:pt-20">
        <p className="px-5 text-center font-[family-name:var(--font-serif)] text-2xl font-medium text-balance text-white italic sm:text-4xl">
          Managing your business with intelligence? Yes, it&apos;s
        </p>
        <Wordmark />
      </div>
    </footer>
  );
}

/** Arrow in a circle; on hover of the parent `group` it flies out to the top right and a fresh one slides in from the bottom left. */
export function ArrowSwap({ className }: { className: string }) {
  const move = "absolute size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full", className)}>
      <ArrowUpRightIcon className={cn(move, "group-hover:translate-x-5 group-hover:-translate-y-5")} />
      <ArrowUpRightIcon className={cn(move, "-translate-x-5 translate-y-5 group-hover:translate-x-0 group-hover:translate-y-0")} />
    </span>
  );
}
