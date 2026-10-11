import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { ChangelogFeed } from "@/components/arc/blocks/changelog-feed/changelog-feed";
import { readChangelog } from "@/features/changelog/changelog";
import { LandingShell } from "@/features/welcome/LandingShell";
import { SiteFooter } from "@/features/welcome/SiteFooter";
import { Threads } from "@/features/welcome/TiltBackground";
import styles from "@/features/changelog/changelog.module.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${SITE.name}: every release, newest first.`,
  alternates: { canonical: "/changelog" },
};

/** Release notes from the README's Changelog section, in the landing frame like the legal pages. */
export default async function ChangelogPage() {
  const { entries, months } = await readChangelog();
  const latest = entries[0];
  return (
    <LandingShell
      backdrop={
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#0a3cff]">
          <Threads />
        </div>
      }
    >
      <div data-hero className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8 sm:pt-24 sm:pb-20">
        {latest && <p className="font-mono text-[13px] tracking-wide text-white/70 uppercase">Latest v{latest.version}, {latest.date}</p>}
        <h1 className="mt-3 font-display text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-6xl">Changelog</h1>
        <p className="mt-5 max-w-2xl text-pretty text-white/85 sm:text-lg">What&apos;s new in {SITE.name}, release by release.</p>
      </div>

      <main id="main" className="relative z-10 shrink-0 rounded-[28px] bg-[#f5f8ff] px-5 pt-14 pb-24 text-[#071447] sm:px-8 sm:pt-20">
        <div className={`mx-auto max-w-3xl ${styles.sheet}`}>
          {entries.length ? (
            <ChangelogFeed
              entries={entries}
              months={months}
              title="Release notes"
              subtitle={latest ? `${SITE.name} ${latest.version} shipped on ${new Date(`${latest.iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}` : undefined}
              endNote={`That is everything since ${SITE.name} ${entries[entries.length - 1].version}.`}
              subscribe={false}
            />
          ) : (
            <p className="text-center text-[#071447]/70">No releases yet. The first one will show up here.</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </LandingShell>
  );
}
