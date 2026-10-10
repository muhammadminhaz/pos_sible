import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import content from "./content.json";
import { SignedInRedirect } from "./interactive";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

// ponytail: placeholder shell; the full copy for each section lives in content.json, keyed by section id.
export function Landing() {
  return (
    <div lang="en" className={cn(geist.variable, "bg-background text-foreground")}>
      <SignedInRedirect />
      <main id="main">
        {content.sections.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-title`}
            className="grid min-h-dvh place-items-center border-b px-4 text-center"
          >
            {i === 0 ? (
              <h1 id={`${s.id}-title`} className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{s.title}</h1>
            ) : (
              <h2 id={`${s.id}-title`} className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{s.title}</h2>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
