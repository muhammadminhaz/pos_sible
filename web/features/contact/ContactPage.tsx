import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, CalendarClockIcon, ClockIcon, MailIcon, MapPinIcon, PhoneOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE, bookingHref, emailHref } from "@/lib/site";
import content from "@/features/landing/content.json";
import { LandingShell } from "@/features/welcome/LandingShell";
import { SiteFooter } from "@/features/welcome/SiteFooter";
import { Threads } from "@/features/welcome/TiltBackground";

type Plan = { id: string; label: string; price: number; usersLabel: string };
const PLANS = (content.sections.find((s) => s.id === "pricing") as unknown as { plans: Plan[] }).plans;

// ponytail: placeholder office until the real address is chosen; change OFFICE and the map follows.
const OFFICE = { lines: ["Level 5, House 42, Road 11", "Banani, Dhaka 1213, Bangladesh"], hours: "Sunday to Thursday, 10 am to 6 pm", lat: 23.794, lon: 90.4043 };
const MAP = `https://www.openstreetmap.org/export/embed.html?bbox=${OFFICE.lon - 0.012}%2C${OFFICE.lat - 0.007}%2C${OFFICE.lon + 0.012}%2C${OFFICE.lat + 0.007}&layer=mapnik&marker=${OFFICE.lat}%2C${OFFICE.lon}`;
const DIRECTIONS = `https://www.google.com/maps/search/?api=1&query=${OFFICE.lat},${OFFICE.lon}`;

const STEPS = [
  { title: "Talk to us", body: "A short call about your shop, your counters and how many people will use it." },
  { title: "Pick your plan", body: "We confirm the plan and modules that fit. No surprises later." },
  { title: "Pay by bKash or bank", body: "Pay for your first month. We send the details after the call." },
  { title: "Start selling", body: "We create your account and send your sign-in. Your team can start the same day." },
];

/**
 * How people get an account: accounts are created by us after a call and payment, so every "get started" lands here.
 * `plan` (from pricing) or `topic` ("support", "call") decides what the call and email are about, so sales knows before it starts.
 */
export function ContactPage({ plan: planId, topic }: { plan?: string; topic?: string }) {
  const plan = PLANS.find((p) => p.id === planId);
  const support = topic === "support";
  const subject = plan ? `${SITE.name} ${plan.label} plan` : support ? `${SITE.name} support` : `${SITE.name} discovery call`;
  const book = bookingHref(subject);
  const mail = emailHref(subject);
  const missing = !book && !mail ? "Not set up yet. Please visit our office below." : "Not available just yet. Please use the other option.";

  return (
    <LandingShell
      backdrop={
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#0a3cff]">
          <Threads />
        </div>
      }
    >
      <div data-hero className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8 sm:pt-24 sm:pb-20">
        <p className="font-mono text-[13px] tracking-wide text-white/75 uppercase">Contact Us</p>
        <h1 className="mt-3 max-w-3xl text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-6xl">
          {support ? "How can we help? " : "Let's set up your shop. "}
          <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#d8ecff] italic">Book a call or write to us.</span>
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-white/85 sm:text-lg">
          {support
            ? "Locked out, or something not working? Tell us your business name and username and we will sort it out."
            : "Accounts are opened by our team, so nobody gets a half-set-up shop. A quick call is all it takes."}
        </p>
        {plan && (
          <p className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full bg-white/10 py-1.5 pr-4 pl-1.5 text-sm ring-1 ring-white/25">
            <span className="rounded-full bg-white px-3 py-1 font-semibold text-[#0a3cff]">{plan.label}</span>
            <span>
              ৳{plan.price.toLocaleString("en-IN")} a month, {plan.usersLabel.toLowerCase()}
            </span>
            <Link href="/welcome#pricing" className="text-white/75 underline underline-offset-4 hover:text-white">Change plan</Link>
          </p>
        )}
      </div>

      <main id="main" className="relative z-10 shrink-0 rounded-[28px] bg-[#f5f8ff] px-4 pt-14 pb-20 text-[#071447] sm:px-8 sm:pt-20">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          <Channel
            featured
            icon={<CalendarClockIcon />}
            title="Book a call"
            body="20 minutes by phone or video. We look at how your shop runs, answer your questions and get your account ready."
            href={book}
            action="Pick a time"
            hint={`Opens our booking page with "${subject}" noted`}
            missing={missing}
          />
          <Channel
            icon={<MailIcon />}
            title="Send an email"
            body={SITE.contactEmail ? `Write to ${SITE.contactEmail}. We reply within one working day, in English or বাংলা.` : "Write to us and we reply within one working day, in English or বাংলা."}
            href={mail}
            action="Write to us"
            hint={`Subject is set to "${subject}"`}
            missing={missing}
          />
        </div>

        {!support && (
          <section aria-labelledby="steps-title" className="mx-auto mt-20 max-w-5xl">
            <h2 id="steps-title" className="text-center text-[1.75rem] font-semibold tracking-[-0.03em] sm:text-4xl">From first call to first sale</h2>
            <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-[22px] bg-white p-6 shadow-[0_24px_48px_-36px_rgb(7_20_71/0.35)] ring-1 ring-[#071447]/[0.07]">
                  <span className="grid size-9 place-items-center rounded-full bg-[#0a3cff] font-mono text-sm font-medium text-white">{i + 1}</span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-pretty text-[#071447]/65">{s.body}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-labelledby="office-title" className="mx-auto mt-20 grid max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_60px_-40px_rgb(7_20_71/0.4)] ring-1 ring-[#071447]/[0.07] lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col p-7 sm:p-9">
            <p className="font-mono text-xs tracking-wide text-[#071447]/55 uppercase">Our office</p>
            <h2 id="office-title" className="mt-3 text-2xl font-semibold tracking-tight">Come and see us in Dhaka</h2>
            <address className="mt-6 grid gap-4 text-[15px] not-italic">
              <p className="flex gap-3">
                <MapPinIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-[#0a3cff]" />
                <span>{OFFICE.lines.map((l) => <span key={l} className="block">{l}</span>)}</span>
              </p>
              <p className="flex gap-3">
                <ClockIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-[#0a3cff]" />
                {OFFICE.hours}
              </p>
            </address>
            <a href={DIRECTIONS} target="_blank" rel="noreferrer" className="mt-8 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[#071447] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3cff] lg:mt-auto">
              Get directions
              <ArrowUpRightIcon aria-hidden className="size-4" />
            </a>
          </div>
          <iframe title={`Map of our office in ${OFFICE.lines[1]}`} src={MAP} loading="lazy" className="h-80 w-full border-0 lg:h-full lg:min-h-96" />
        </section>
      </main>
      <SiteFooter />
    </LandingShell>
  );
}

/** One way to reach us. With no address configured it says so plainly instead of offering a dead button. */
function Channel({ featured, icon, title, body, href, action, hint, missing }: { featured?: boolean; icon: ReactNode; title: string; body: string; href: string | null; action: string; hint: string; missing: string }) {
  return (
    <article className={cn("flex flex-col rounded-[24px] p-7 ring-1 sm:p-8", featured ? "bg-[linear-gradient(180deg,#0b2bb8,#071447_70%)] text-white shadow-[0_40px_80px_-40px_rgb(10_60_255/0.7)] ring-[#3f82ff]/40" : "bg-white ring-[#071447]/[0.07]")}>
      <span className={cn("grid size-12 place-items-center rounded-2xl [&_svg]:size-5", featured ? "bg-white text-[#0a3cff]" : "bg-[#0a3cff] text-white")}>{icon}</span>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className={cn("mt-2 text-[15px] leading-relaxed text-pretty", featured ? "text-white/75" : "text-[#071447]/65")}>{body}</p>
      <div className="mt-auto pt-8">
        {href ? (
          <>
            <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cn("flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-[transform,background-color] active:scale-[0.98]", featured ? "bg-white text-[#071447] hover:bg-[#d8ecff]" : "bg-[#071447] text-white hover:bg-[#0a3cff]")}>
              {action}
              <ArrowUpRightIcon aria-hidden className="size-4" />
            </a>
            <p className={cn("mt-2.5 text-center text-xs text-pretty", featured ? "text-white/55" : "text-[#071447]/50")}>{hint}</p>
          </>
        ) : (
          <p className={cn("flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm", featured ? "bg-white/10 text-white/75" : "bg-[#071447]/[0.04] text-[#071447]/60")}>
            <PhoneOffIcon aria-hidden className="size-4 shrink-0" />
            {missing}
          </p>
        )}
      </div>
    </article>
  );
}
