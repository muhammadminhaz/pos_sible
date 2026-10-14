"use client";

import { useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRightIcon, CheckIcon, PhoneCallIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { contactHref } from "@/lib/site";
import content from "@/features/landing/content.json";
import LightRays from "@/components/ui/light-rays";
import { Squircle, useLoop, useStill } from "./Features";
import { Threads } from "./TiltBackground";

const ease = [0.16, 1, 0.3, 1] as const;
const section = <T,>(id: string) => content.sections.find((s) => s.id === id) as T;

type Problem = { rows: { before: string; after: string }[]; beforeLabel: string; afterLabel: string };
type Loop = { steps: string[]; note: string };
type Basics = { items: { name: string; dot: string }[] };
type Faqs = { items: { q: string; a: string }[] };
type Pricing = {
  title: string;
  body: string;
  note: string;
  best: string;
  plans: { id: string; label: string; price: number; blurb: string; usersLabel: string; featured?: boolean; modules: string[] }[];
  planFeatures: string[];
  modules: { id: string; label: string }[];
};

/** Ink panel set into the pale sheet, with the hero's threads faint behind it: what POS-sible does that a cash register with a report does not. */
export function WhyChoose() {
  const problem = section<Problem>("problem");
  const pays = section<Basics>("basics").items.slice(0, 8);
  return (
    <section id="why" aria-labelledby="why-title" className="scroll-mt-20 px-2 sm:px-4">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#071447,#0b1f6e)] px-4 py-20 text-white sm:px-8 sm:py-28">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-60">
          <Threads />
        </div>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="flex items-center gap-2 font-mono text-[13px] font-medium tracking-wide uppercase">
            <Squircle className="size-4" />
            Why POS-sible
          </p>
          <h2 id="why-title" className="mt-4 font-display text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.5rem]">
            Other POS software counts.{" "}
            <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#9fd0ff] italic">Ours thinks ahead.</span>
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-white/65 sm:text-lg">Most POS software records everything and explains nothing. You still do the thinking, at night, with a spreadsheet.</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:mt-16 lg:grid-cols-12">
          <Card className="lg:col-span-7" title="It keeps going after the sale" body={section<Loop>("loop").note}>
            <Chain />
          </Card>
          <Card className="lg:col-span-5" title="Made for how Bangladesh pays" body="Split one bill across any of these. Every screen also speaks বাংলা.">
            <ul className="flex flex-wrap gap-2">
              {pays.map((p) => (
                <li key={p.name} className="flex h-9 items-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-sm ring-1 ring-white/10">
                  <span className={cn("size-2 rounded-full", p.dot)} />
                  {p.name}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-7" title="Answers, not reports" body="The same numbers, read for you.">
            <ul className="grid gap-2">
              {problem.rows.map((r) => (
                <li key={r.before} className="grid items-center gap-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:grid-cols-[10rem_auto_1fr] sm:gap-4">
                  <span className="font-mono text-xs text-white/45">
                    <span className="sr-only">{problem.beforeLabel}: </span>
                    {r.before}
                  </span>
                  <ArrowRightIcon aria-hidden className="hidden size-4 text-[#9fd0ff] sm:block" />
                  <span className="text-[15px] text-pretty">
                    <span className="sr-only">{problem.afterLabel}: </span>
                    {r.after}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-5" title="Priced in Taka" body="Pays for itself with one recovered sale. Pay by bKash or bank transfer.">
            <p className="font-display text-5xl font-semibold tracking-[-0.04em]">
              ৳500<span className="ml-1 text-base font-medium tracking-normal text-white/55">a month to start</span>
            </p>
            <ul className="mt-5 grid gap-2.5 text-[15px] text-white/80">
              {["Double-entry books behind every number", "Your data kept apart from other shops", "Stock tracked per branch"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckIcon aria-hidden className="size-4 shrink-0 text-[#9fd0ff]" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}

/** Glass card with React Bits' SpotlightCard glow: a soft light follows the pointer across it. */
function Card({ title, body, children, className }: { title: string; body: string; children: ReactNode; className?: string }) {
  const spot = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  return (
    <motion.article
      onPointerMove={spot}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
      className={cn(
        "relative flex flex-col gap-6 overflow-hidden rounded-[22px] bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur-sm sm:p-7",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(360px_circle_at_var(--x)_var(--y),rgb(159_208_255/0.14),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
        className,
      )}
    >
      <div>
        <h3 className="font-display text-[17px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-pretty text-white/60">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </motion.article>
  );
}

/** Sale to Result as a chain that lights up link by link, with a marker where an ordinary POS stops. */
function Chain() {
  const ref = useRef<HTMLOListElement>(null);
  const steps = section<Loop>("loop").steps;
  const step = useLoop(ref, steps.length + 2, 900, steps.length + 1);
  return (
    <ol ref={ref} className="flex flex-wrap items-center gap-x-1.5 gap-y-3">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn("rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition-colors duration-500", step > i ? "bg-[#0a3cff] text-white ring-[#3f82ff]" : "bg-white/[0.04] text-white/50 ring-white/10")}>{s}</span>
          {i === 0 && <span className="rounded-md border border-dashed border-white/25 px-2 py-1 font-mono text-[10px] tracking-wide text-white/50 uppercase">Others stop here</span>}
          {i < steps.length - 1 && <ArrowRightIcon aria-hidden className="size-3.5 text-white/30" />}
        </li>
      ))}
    </ol>
  );
}

/**
 * Plans side by side in one porcelain card, split by hairlines like a spec sheet. Every plan lists every module in the order
 * the plans add them, so the ticks step down from plan to plan: a solid tick on a highlighted row for what this plan adds, a
 * soft tick for what it keeps from the one below, a faint cross for what it lacks. The featured plan is a navy column lit by a blue beam.
 * Every button opens /contact with the plan chosen: accounts are set up by us after a call and payment.
 * Columns share rows (subgrid), so prices, dividers and buttons line up whatever the copy length.
 */
export function PricingPlans() {
  const p = section<Pricing>("pricing");
  const label = (id: string) => p.modules.find((m) => m.id === id)!.label;
  const tier = (id: string) => p.plans.findIndex((x) => x.modules.includes(id));
  const ordered = [...p.modules].sort((a, b) => tier(a.id) - tier(b.id)).map((m) => m.id);
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 px-4 pt-20 pb-8 sm:px-8 sm:pt-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <p className="flex items-center gap-2 font-mono text-[13px] font-medium tracking-wide uppercase">
          <Squircle className="size-4" />
          Pricing
        </p>
        <h2 id="pricing-title" className="mt-4 font-display text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          Pays for itself with{" "}
          <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#0a3cff] italic">one recovered sale</span>
        </h2>
        <p className="mt-4 max-w-lg text-pretty text-[#071447]/65 sm:text-lg">{p.body}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease }}
        className="mx-auto mt-14 grid max-w-5xl gap-3 sm:mt-16 md:grid-cols-3 md:gap-0 md:rounded-[28px] md:bg-[linear-gradient(165deg,#ffffff_0%,#f1f5ff_60%,#e8f0ff_100%)] md:shadow-[inset_0_1px_0_white,0_30px_60px_-40px_rgb(7_20_71/0.4)] md:ring-1 md:ring-[#071447]/[0.07]"
      >
        {p.plans.map((plan, i) => {
          const lit = !!plan.featured;
          const below = p.plans[i - 1];
          const added = below ? plan.modules.filter((m) => !below.modules.includes(m)) : plan.modules;
          return (
            <article
              key={plan.id}
              aria-labelledby={`plan-${plan.id}`}
              className={cn(
                "relative isolate flex flex-col rounded-[24px] ring-1 md:row-span-4 md:grid md:grid-rows-subgrid md:rounded-none md:ring-0",
                lit
                  ? "mt-9 text-white ring-0 md:z-10 md:-my-4"
                  : "overflow-hidden bg-[linear-gradient(165deg,#ffffff,#eef3ff)] ring-[#071447]/[0.07] md:bg-none",
              )}
            >
              {lit && (
                <>
                  {/* A blue shell with the card's own rounded corners, peeking out above it and running down behind its rounded top,
                      so the label sits in a frame around the plan rather than on a flat strip. */}
                  <p className="absolute inset-x-0 -top-9 -z-20 flex h-[calc(2.25rem+28px)] justify-center rounded-t-[24px] bg-[linear-gradient(180deg,#3f82ff,#1f55ff)] pt-2.5 text-[13px] font-semibold tracking-wide text-white shadow-[0_-10px_30px_-12px_rgb(63_130_255/0.6)] md:rounded-t-[28px]">
                    <span className="wl-beacon">{p.best}</span>
                  </p>
                  {/* Light pooling under the label at the card's top edge, as if the rays below pour out of it. */}
                  <span aria-hidden className="wl-beacon-halo pointer-events-none absolute top-0 left-1/2 -z-[5] h-36 w-72 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/0.75),rgb(207_230_255/0.35)_30%,rgb(159_208_255/0.12)_55%,transparent_72%)] blur-[3px]" />
                  <span aria-hidden className="absolute inset-0 -z-10 rounded-[24px] bg-[linear-gradient(180deg,#0b2bb8_0%,#071447_55%)] shadow-[0_40px_80px_-30px_rgb(10_60_255/0.6)] ring-1 ring-[#3f82ff]/40 md:rounded-[28px]" />
                </>
              )}
              {lit && <LightRay />}
              <div className={cn("flex flex-col border-b px-6 pt-6 pb-5", lit ? "border-white/10" : "border-[#071447]/[0.08]")}>
                <h3 id={`plan-${plan.id}`} className="font-display text-xl font-semibold tracking-tight">{plan.label}</h3>
                <p className={cn("mt-1 text-sm", lit ? "text-white/70" : "text-[#071447]/60")}>{plan.blurb}</p>
                <p className="mt-auto flex items-baseline gap-1.5 pt-4">
                  <span className="font-display text-4xl font-semibold tracking-[-0.04em] tabular-nums">৳{plan.price.toLocaleString("en-IN")}</span>
                  <span className={cn("text-sm", lit ? "text-white/60" : "text-[#071447]/55")}>/month</span>
                </p>
              </div>
              <div className="px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{plan.usersLabel}</p>
                  {below && (
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", lit ? "bg-[#9fd0ff]/15 text-[#cfe6ff] ring-1 ring-[#9fd0ff]/30" : "bg-[#0a3cff]/[0.08] text-[#0a3cff]")}>
                      +{added.length} over {below.label}
                    </span>
                  )}
                </div>
                <ul className="mt-4 grid gap-1 text-sm">
                  {ordered.map((m) => {
                    const has = plan.modules.includes(m);
                    const fresh = has && !!below && added.includes(m);
                    return (
                      // Every row has the same padding, so rows line up across plans; new modules get a soft highlight.
                      <li
                        key={m}
                        className={cn(
                          "-mx-2.5 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5",
                          !has && "opacity-45",
                          fresh && (lit ? "bg-white/[0.08] ring-1 ring-[#9fd0ff]/25" : "bg-[#0a3cff]/[0.06] ring-1 ring-[#0a3cff]/15"),
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-[18px] shrink-0 place-items-center rounded-full",
                            !has ? (lit ? "ring-1 ring-white/25 text-white/60" : "ring-1 ring-[#071447]/20 text-[#071447]/50")
                              : fresh ? (lit ? "bg-[#9fd0ff] text-[#071447]" : "bg-[#0a3cff] text-white")
                              : lit ? "bg-white/10 text-[#9fd0ff]" : "bg-[#0a3cff]/10 text-[#0a3cff]",
                          )}
                        >
                          {has ? <CheckIcon className="size-3" strokeWidth={3} /> : <XIcon className="size-2.5" strokeWidth={2.5} />}
                        </span>
                        <span className={cn("min-w-0 truncate font-medium", lit ? "text-white" : "text-[#071447]", !has && "line-through decoration-1")}>
                          {label(m)}
                          <span className="sr-only">{has ? (fresh ? `, new in ${plan.label}` : ", included") : ", not included"}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="mt-auto px-6 pb-6">
                <a
                  href={contactHref({ plan: plan.id })}
                  className={cn(
                    "group flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-[transform,background-color] active:scale-[0.98]",
                    lit ? "bg-white text-[#071447] hover:bg-[#d8ecff]" : "bg-[#071447] text-white hover:bg-[#0a3cff]",
                  )}
                >
                  <PhoneCallIcon aria-hidden className="size-4" />
                  Contact sales
                </a>
              </div>
            </article>
          );
        })}
      </motion.div>

      <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="font-mono text-xs tracking-wide text-[#071447]/55 uppercase">Every plan includes</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {p.planFeatures.map((f) => (
            <li key={f} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium ring-1 ring-[#071447]/[0.08]">{f}</li>
          ))}
        </ul>
        <p className="max-w-md text-sm text-pretty text-[#071447]/55">{p.note}</p>
      </div>
    </section>
  );
}

/** React Bits' LightRays falling from the top of the featured plan. Under reduced motion it holds still. */
function LightRay() {
  const still = useStill();
  return (
    // The card no longer clips (its label shell sits outside it), so the rays clip here, to the card's rounded shape.
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[24px] md:rounded-[28px]">
      <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,#9fd0ff,transparent)]" />
      {/* The rays are tuned for full-screen backgrounds; a canvas wider than the card keeps them crisp, and the card crops the middle. */}
      <div className="absolute top-0 left-1/2 h-[110%] w-[260%] -translate-x-1/2">
        <LightRays raysOrigin="top-center" raysColor="#ffffff" raysSpeed={still ? 0 : 1.2} lightSpread={1.3} rayLength={2.6} fadeDistance={1.4} saturation={1} followMouse={!still} mouseInfluence={0.08} noiseAmount={0.05} distortion={0.04} />
      </div>
    </div>
  );
}

/** One answer open at a time. Rows grow 0fr to 1fr so the panel eases open without measuring, and the answer rises out of a blur. */
export function Faq() {
  const faq = section<Faqs & { title: string; body: string }>("faq");
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="flex items-center gap-2 font-mono text-[13px] font-medium tracking-wide uppercase">
            <Squircle className="size-4" />
            FAQ
          </p>
          <h2 id="faq-title" className="mt-4 font-display text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            Questions owners{" "}
            <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#0a3cff] italic">ask first</span>
          </h2>
          <p className="mt-4 max-w-sm text-pretty text-[#071447]/65 sm:text-lg">{faq.body}</p>
          <a href="/contact" className="group mt-7 inline-flex items-center gap-2 text-[15px] font-semibold text-[#0a3cff]">
            Still wondering? Contact us
            <ArrowRightIcon aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </div>

        <ul className="grid gap-2">
          {faq.items.map((item, i) => {
            const on = open === i;
            return (
              <li key={item.q} className={cn("rounded-2xl ring-1 transition-[background-color,box-shadow] duration-500", on ? "bg-white shadow-[0_24px_48px_-32px_rgb(7_20_71/0.35)] ring-[#071447]/[0.07]" : "ring-transparent hover:bg-white/60")}>
                <h3>
                  <button
                    type="button"
                    id={`${id}-q${i}`}
                    aria-expanded={on}
                    aria-controls={`${id}-a${i}`}
                    onClick={() => setOpen(on ? null : i)}
                    className="flex w-full items-center justify-between gap-6 rounded-2xl px-5 py-5 text-left font-display text-[17px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[#0a3cff]"
                  >
                    {item.q}
                    <PlusMinus on={on} />
                  </button>
                </h3>
                <div id={`${id}-a${i}`} role="region" aria-labelledby={`${id}-q${i}`} inert={!on} className={cn("grid transition-[grid-template-rows] duration-500 ease-[var(--wl-ease)] motion-reduce:transition-none", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <p className={cn("px-5 pb-6 text-[15px] leading-relaxed text-pretty text-[#071447]/65 transition-[opacity,translate,filter] duration-500 ease-[var(--wl-ease)] motion-reduce:transition-none", on ? "translate-y-0 opacity-100 blur-none" : "-translate-y-2 opacity-0 blur-[3px]")}>{item.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** A plus whose upright bar turns flat into a minus while the disc fills blue. */
function PlusMinus({ on }: { on: boolean }) {
  const bar = "absolute h-[1.5px] w-3.5 rounded-full bg-current transition-transform duration-500 ease-[var(--wl-ease)]";
  return (
    <span aria-hidden className={cn("relative grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-500", on ? "bg-[#0a3cff] text-white" : "bg-[#071447]/[0.06] text-[#071447]")}>
      <span className={bar} />
      <span className={cn(bar, on ? "rotate-0" : "rotate-90")} />
    </span>
  );
}
