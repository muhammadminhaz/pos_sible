import type { ReactNode } from "react";
import { SiteFooter } from "@/features/welcome/SiteFooter";
import { LandingShell } from "@/features/welcome/LandingShell";
import { Threads } from "@/features/welcome/TiltBackground";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Inside the landing frame: the title on flat brand blue with threads, then a pale sheet with a contents list that sticks beside the text from 1024px, then the site footer. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <LandingShell
      backdrop={
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#0a3cff]">
          <Threads />
        </div>
      }
    >
      <div data-hero className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8 sm:pt-24 sm:pb-20">
        <p className="font-mono text-[13px] tracking-wide text-white/70 uppercase">Last updated {updated}</p>
        <h1 className="mt-3 font-display text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-6xl">{title}</h1>
        <div className="mt-5 max-w-2xl text-pretty text-white/85 sm:text-lg">{intro}</div>
      </div>

      {/* Pale sheet like the landing page's; its rounded foot overlaps the footer. */}
      <main id="main" className="relative z-10 shrink-0 rounded-[28px] bg-[#f5f8ff] px-5 pt-14 pb-24 text-[#071447] sm:px-8 sm:pt-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[14rem_1fr] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-xs tracking-wide text-[#071447]/55 uppercase">On this page</p>
            <ol className="mt-4 grid gap-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-[#071447]/70 transition-colors hover:text-[#0a3cff]">
                    <span className="w-5 shrink-0 font-mono text-[#071447]/40 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="grid max-w-2xl gap-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
                <h2 id={`${s.id}-title`} className="font-display text-2xl font-semibold tracking-tight">{s.title}</h2>
                <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-pretty text-[#071447]/75 [&_a]:font-medium [&_a]:text-[#0a3cff] [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-[#071447] [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </LandingShell>
  );
}

/** Points to the contact page, where people can book a call or email us. */
export function ContactLine() {
  return <>reach us through our <a href="/contact">contact page</a></>;
}
