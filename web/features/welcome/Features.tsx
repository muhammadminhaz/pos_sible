"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { AnimatePresence, MotionConfig, type MotionValue, animate, easeInOut, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { BadgePercentIcon, BookOpenIcon, CheckIcon, HandCoinsIcon, InboxIcon, PackageIcon, ScanLineIcon, ShoppingBasketIcon, TargetIcon, TruckIcon, UserRoundIcon, UsersRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduceChange = (cb: () => void) => {
  const mq = matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** Reduced motion, but false while hydrating so the first client render matches the server (motion's hook reads it at once). */
export const useStill = () => useSyncExternalStore(onReduceChange, () => matchMedia(REDUCE).matches, () => false);

/** Counts 0..steps-1 forever, every `ms`, only while `ref` is on screen and motion is allowed; otherwise holds `rest`. */
export function useLoop(ref: RefObject<Element | null>, steps: number, ms: number, rest = steps - 1) {
  const reduce = useStill();
  const seen = useInView(ref, { amount: 0.3 });
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce || !seen) return;
    const id = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => clearInterval(id);
  }, [reduce, seen, steps, ms]);
  return reduce ? rest : step;
}

/** A squircle that turns slowly: the eyebrow mark for the landing sections. */
export function Squircle({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("animate-[spin_8s_linear_infinite] motion-reduce:animate-none", className)}>
      <defs>
        <linearGradient id="sq-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a3cff" />
          <stop offset="1" stopColor="#6aa8ff" />
        </linearGradient>
      </defs>
      <path fill="url(#sq-fill)" d="M12 2c7.4 0 10 2.6 10 10s-2.6 10-10 10S2 19.4 2 12 4.6 2 12 2Z" />
    </svg>
  );
}

/** Bento of what POS-sible does: the intelligence first (wide tile), the everyday POS around it. Every tile plays a short loop of the real job. */
export function Features() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="features" aria-labelledby="features-title" className="scroll-mt-20 px-4 pt-16 pb-24 sm:px-8 sm:pt-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="flex items-center gap-2 font-mono text-[13px] font-medium tracking-wide uppercase">
            <Squircle className="size-4" />
            Features
          </p>
          <h2 id="features-title" className="mt-4 font-display text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.5rem]">
            Everything a shop needs,{" "}
            <span className="font-[family-name:var(--font-serif)] text-[1.1em] font-medium tracking-[-0.02em] text-[#0a3cff] italic">and a second brain</span>
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-[#071447]/65 sm:text-lg">
            Checkout, stock and dues run the day. POS-sible reads all of it and tells you where the money is hiding.
          </p>
        </div>

        {/* 12 columns from 1024px: rows of 5+7, 4+4+4, 7+5, so the wide tiles zigzag like a magazine spread. */}
        <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:mt-16 md:grid-cols-2 lg:grid-cols-12">
          <Tile className="lg:col-span-5" visual={<Window tab="Counter 1" className="max-w-[300px]"><Checkout /></Window>} title="Checkout in seconds" body="Scan, split one bill across cash, card, bKash or Nagad, and print to a thermal printer." />
          <Tile className="md:col-span-2 lg:col-span-7" visual={<Window tab="Opportunity inbox" className="max-w-xl"><Inbox /></Window>} title="Opportunity inbox" body="All day it scans sales, stock and dues, ranks what it finds by money at stake and keeps the list fresh." />
          <Tile className="lg:col-span-4" visual={<Forecast />} title="Sales you can see coming" body="Spot the slow Saturday before it happens, with a forecast drawn from your own history." />
          <Tile className="lg:col-span-4" visual={<Goals />} title="Goals that show the way" body="Set a monthly target. See your pace and exactly how much to add each day to reach it." />
          <Tile className="md:col-span-2 lg:col-span-4" visual={<Stock />} title="Stock in every branch" body="Live counts per location, and a transfer suggested before any shelf runs empty." />
          <Tile className="md:col-span-2 lg:col-span-7" visual={<Pipeline />} title="One sale, every book updated" body="Each sale moves stock, posts to double-entry books and feeds the inbox. Your insights and your accounts read the same numbers." />
          <Tile className="md:col-span-2 lg:col-span-5" visual={<Bilingual />} title="English or বাংলা" body="Every screen, receipt and report in either language. Switch any time, nothing changes underneath." />
        </div>
      </section>
    </MotionConfig>
  );
}

/** Soft porcelain card: copy on top, the visual below on a pale wash. The visual loops forever, so it is hidden from screen readers; the copy says the same thing once. */
function Tile({ visual, title, body, className }: { visual: ReactNode; title: string; body: string; className?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
      className={cn("flex flex-col overflow-hidden rounded-[22px] bg-[linear-gradient(165deg,#ffffff_0%,#f1f5ff_55%,#e4edff_100%)] shadow-[inset_0_1px_0_white,0_24px_48px_-36px_rgb(7_20_71/0.35)] ring-1 ring-[#071447]/[0.07]", className)}
    >
      <div className="px-6 pt-6 sm:px-7 sm:pt-7">
        <h3 className="font-display text-[17px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 max-w-md text-[15px] leading-relaxed text-pretty text-[#071447]/60">{body}</p>
      </div>
      <div aria-hidden className="relative flex min-h-72 flex-1 items-center justify-center px-5 pt-8 pb-6 sm:px-8">{visual}</div>
    </motion.article>
  );
}

/** A ghost browser window: hollow traffic lights and one tab, the app inside sitting on white. Sinks into the tile's bottom edge. */
function Window({ tab, children, className }: { tab: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mb-6 w-full self-end rounded-t-[22px] bg-white/55 px-2 pb-2 shadow-[inset_0_1px_0_white,0_30px_60px_-30px_rgb(7_20_71/0.35)] ring-1 ring-[#071447]/[0.06]", className)}>
      <div className="flex h-10 items-end gap-3 px-2">
        <span className="flex gap-1.5 pb-3.5">
          {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full ring-1 ring-[#071447]/15" />)}
        </span>
        <span className="flex h-8 min-w-0 items-center gap-2 rounded-t-xl bg-white px-3.5 text-xs font-medium ring-1 ring-[#071447]/[0.06]">
          <span className="grid size-4 place-items-center rounded bg-[#0a3cff] text-[9px] font-bold text-white">P</span>
          <span className="truncate">{tab}</span>
        </span>
      </div>
      <div className="rounded-[14px] bg-white ring-1 ring-[#071447]/[0.06]">{children}</div>
    </div>
  );
}

/** White node with a soft lift, the building block of the diagrams. `on` fills it blue. */
function Chip({ on, children, className }: { on?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl ring-1 transition-colors duration-500 [&_svg]:size-[18px]", on ? "bg-[#0a3cff] text-white ring-[#0a3cff]" : "bg-white text-[#071447]/70 shadow-[0_10px_24px_-12px_rgb(7_20_71/0.35)] ring-[#071447]/[0.06]", className)}>
      {children}
    </span>
  );
}

const panel = "rounded-2xl bg-white text-[#071447] shadow-[0_20px_50px_-24px_rgb(5_20_120/0.35)] ring-1 ring-[#071447]/8";

const FINDS = [
  { icon: PackageIcon, title: "Restock Coca-Cola 500ml", meta: "Runs out in about 4 days", value: "৳12,400 at risk", tint: "bg-amber-100 text-amber-700" },
  { icon: UserRoundIcon, title: "Win back 23 regulars", meta: "No visit in 60 days", value: "৳31,800 a month", tint: "bg-sky-100 text-sky-700" },
  { icon: HandCoinsIcon, title: "Collect overdue dues", meta: "9 customers, over 30 days", value: "৳37,193 owed", tint: "bg-emerald-100 text-emerald-700" },
  { icon: BadgePercentIcon, title: "Raise Miniket rice by ৳2", meta: "Sells out at today's price", value: "৳4,800 a month", tint: "bg-violet-100 text-violet-700" },
  { icon: TruckIcon, title: "Move 40 bags to Mirpur", meta: "Warehouse has spare stock", value: "৳9,600 saved", tint: "bg-rose-100 text-rose-700" },
];

/** A live queue: every few seconds a new find lands on top and the oldest drops off. */
function Inbox() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useLoop(ref, FINDS.length, 2800, 0);
  const shown = [0, 1, 2].map((i) => FINDS[(step + FINDS.length - i) % FINDS.length]);
  return (
    <div ref={ref} className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold">Today&apos;s opportunities</p>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#0a3cff]/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#0a3cff]">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#0a3cff] opacity-60 motion-reduce:hidden" />
            <span className="relative size-1.5 rounded-full bg-[#0a3cff]" />
          </span>
          Live
        </span>
      </div>
      <ul className="relative mt-4 grid gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((f, i) => (
            <motion.li
              key={f.title}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.6, ease }}
              className={cn("flex items-center gap-3 rounded-xl border p-3 transition-colors duration-700", i === 0 ? "border-[#0a3cff]/30 bg-[#0a3cff]/[0.04]" : "border-[#071447]/8")}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", f.tint)}>
                <f.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.title}</p>
                <p className="truncate text-xs text-[#071447]/55">{f.meta}</p>
              </div>
              <span className="hidden shrink-0 text-xs font-semibold text-[#0a3cff] sm:block">{f.value}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

// A week of sales, then a dashed forecast for the coming days.
const LINE = "M8 92 C40 88 52 60 78 64 S118 40 140 52 S176 78 196 58 S236 22 258 34";
const AHEAD = "M258 34 C276 40 288 30 312 26";
const useKeys = (t: MotionValue<number>, times: number[], values: number[]) => useTransform(t, times, values, { ease: easeInOut });

// The finished chart: where the loop rests offscreen and under reduced motion.
const HOLD = 0.6;

/**
 * The week draws itself, the forecast reaches ahead, it holds, then fades and starts over. Reduced motion shows the finished chart.
 * One clock drives every part: separate keyframe loops drift apart (motion runs opacity off-thread, pathLength on the main thread), which flashed the full chart at each restart.
 */
function Forecast() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useStill();
  const seen = useInView(ref, { amount: 0.3 });
  const t = useMotionValue(HOLD);
  useEffect(() => {
    if (reduce || !seen) {
      t.set(HOLD);
      return;
    }
    const run = animate(t, [0, 1], { duration: 5, ease: "linear", repeat: Infinity });
    return () => run.stop();
  }, [reduce, seen, t]);
  const fill = useKeys(t, [0, 0.3, 0.45, 0.85, 1], [0, 0, 1, 1, 0]);
  const line = useKeys(t, [0, 0.35, 0.85, 1], [0, 1, 1, 1]);
  // Starts hidden too: a round cap on a zero-length path still paints a dot.
  const fade = useKeys(t, [0, 0.02, 0.85, 1], [0, 1, 1, 0]);
  const ahead = useKeys(t, [0, 0.35, 0.5, 0.85, 1], [0, 0, 1, 1, 1]);
  const aheadFade = useKeys(t, [0, 0.35, 0.5, 0.85, 1], [0, 0, 0.55, 0.55, 0]);
  const dot = useKeys(t, [0, 0.33, 0.4, 0.45, 0.85, 1], [0, 0, 1.4, 1, 1, 0]);
  return (
    <div ref={ref} className={cn(panel, "w-full max-w-xs p-4")}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-[#071447]/55">This week</p>
        <p className="text-xs font-medium text-emerald-600">+12.4%</p>
      </div>
      <p className="font-display text-2xl font-semibold tracking-tight">৳1,24,580</p>
      <svg viewBox="0 0 320 110" className="mt-3 w-full overflow-visible">
        <defs>
          <linearGradient id="fc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0a3cff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#0a3cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={`${LINE} V110 H8 Z`} fill="url(#fc-fill)" style={{ opacity: fill }} />
        <motion.path d={LINE} fill="none" stroke="#0a3cff" strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: line, opacity: fade }} />
        <motion.path d={AHEAD} fill="none" stroke="#0a3cff" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" style={{ pathLength: ahead, opacity: aheadFade }} />
        <motion.circle cx="258" cy="34" r="5" fill="white" stroke="#0a3cff" strokeWidth="2.5" style={{ scale: dot }} />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-[#071447]/45">
        {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Next"].map((d) => <span key={d}>{d}</span>)}
      </div>
    </div>
  );
}

const CART = [["Coca-Cola 500ml × 2", 80], ["Bread", 60], ["Rice 5kg", 200]] as const;

/** A sale rings up: three scans, the bill splits across cash and bKash, a Paid stamp, then the till clears. Reduced motion shows the split bill. */
function Checkout() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useLoop(ref, 8, 900, 5); // 0-2 scanning, 3 total, 4-5 payments, 6-7 paid
  const items = CART.slice(0, Math.min(step + 1, CART.length));
  const total = items.reduce((sum, [, price]) => sum + price, 0);
  const paid = step >= 6;
  return (
    <div ref={ref} className="relative overflow-hidden rounded-[14px] p-4">
      <div className="flex items-center gap-1.5 text-xs text-[#071447]/55">
        <ScanLineIcon className="size-3.5 text-[#0a3cff]" />
        {step < 3 ? "Scanning…" : paid ? "Sale complete" : "Split payment"}
      </div>
      <ul className="mt-2 min-h-[84px]">
        <AnimatePresence initial={false}>
          {items.map(([name, price]) => (
            <motion.li key={name} initial={{ opacity: 0, x: -12, backgroundColor: "rgb(10 60 255 / 0.12)" }} animate={{ opacity: 1, x: 0, backgroundColor: "rgb(10 60 255 / 0)" }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }} className="-mx-1.5 flex justify-between rounded-md px-1.5 py-1 text-sm">
              <span className="text-[#071447]/70">{name}</span>
              <span className="font-medium tabular-nums">৳{price}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-1 flex justify-between border-t border-dashed border-[#071447]/15 pt-2 text-sm font-semibold">
        <span>Total</span>
        <motion.span key={total} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">৳{total}</motion.span>
      </div>
      <div className="mt-3 flex h-8 gap-2">
        {[{ name: "Cash", amount: "৳200", dot: "bg-emerald-500", at: 4 }, { name: "bKash", amount: "৳140", dot: "bg-bkash", at: 5 }].map((p) => (
          <motion.span
            key={p.name}
            animate={step >= p.at ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease }}
            className="flex flex-1 items-center gap-1.5 rounded-lg bg-[#f5f8ff] px-2 text-xs font-medium"
          >
            <span className={cn("size-2 rounded-full", p.dot)} />
            {p.name} <span className="ml-auto tabular-nums text-[#071447]/60">{p.amount}</span>
          </motion.span>
        ))}
      </div>
      <AnimatePresence>
        {paid && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-white/75 backdrop-blur-[2px]">
            <motion.span initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              <CheckIcon className="size-4" /> Paid ৳340
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BRANCHES = ["Dhanmondi", "Mirpur", "Warehouse"];
// Shelf levels per step: sales draw stock down, Mirpur runs low, a transfer from the warehouse tops it up.
const LEVELS = [
  [0.86, 0.62, 0.8],
  [0.78, 0.4, 0.8],
  [0.72, 0.18, 0.8],
  [0.72, 0.18, 0.8],
  [0.7, 0.52, 0.47],
  [0.86, 0.62, 0.8],
];

function Stock() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useLoop(ref, LEVELS.length, 1600, 2);
  const low = step === 2 || step === 3;
  const moving = step === 4;
  return (
    <div ref={ref} className={cn(panel, "w-full max-w-[260px] p-4")}>
      <p className="text-xs text-[#071447]/55">Rice 5kg</p>
      <ul className="mt-3 grid gap-3">
        {BRANCHES.map((name, i) => {
          const level = LEVELS[step][i];
          const warn = name === "Mirpur" && low;
          return (
            <li key={name}>
              <div className="flex justify-between text-xs">
                <span className="font-medium">{name}</span>
                <span className={cn("tabular-nums transition-colors", warn ? "font-medium text-amber-700" : "text-[#071447]/55")}>{Math.round(level * 120)} bags</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#071447]/8">
                <motion.div className={cn("h-full origin-left rounded-full transition-colors duration-500", warn ? "bg-amber-500" : "bg-[#0a3cff]")} initial={false} animate={{ scaleX: level }} transition={{ duration: 1.1, ease }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="relative mt-3 h-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={low ? "low" : moving ? "move" : "ok"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className={cn("absolute inset-0 flex items-center gap-2 rounded-lg px-2.5 text-xs", low ? "bg-amber-50 text-amber-800" : moving ? "bg-[#0a3cff]/8 text-[#0a3cff]" : "bg-emerald-50 text-emerald-800")}
          >
            {low ? "Mirpur runs out Thursday. Move 40 from the warehouse?" : moving ? (<><TruckIcon className="size-3.5 shrink-0" /> Moving 40 bags to Mirpur…</>) : "Every branch stocked for the week."}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

const WORDS = [
  { en: "Today's sales", bn: "আজকের বিক্রয়" },
  { en: "Dues to collect", bn: "আদায়যোগ্য বকেয়া" },
  { en: "Low stock", bn: "স্টক কম" },
];

function Bilingual() {
  const ref = useRef<HTMLDivElement>(null);
  const bn = useLoop(ref, 2, 2400, 0) === 1;
  return (
    <div ref={ref} className="w-full max-w-[260px]">
      <div className="relative mx-auto grid w-fit grid-cols-2 rounded-full bg-white p-1 text-xs font-medium shadow-sm ring-1 ring-[#071447]/8">
        <motion.span layout transition={{ duration: 0.5, ease }} className={cn("absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-[#0a3cff]", bn ? "right-1" : "left-1")} />
        <span className={cn("relative z-10 px-4 py-1.5 transition-colors", !bn && "text-white")}>EN</span>
        <span lang="bn" className={cn("relative z-10 px-4 py-1.5 transition-colors", bn && "text-white")}>বাং</span>
      </div>
      <ul className="mt-4 grid gap-2">
        {WORDS.map((w, i) => (
          <li key={w.en} className="relative h-11 overflow-hidden rounded-xl bg-white px-3 shadow-[0_10px_30px_-18px_rgb(5_20_120/0.4)] ring-1 ring-[#071447]/8">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={bn ? "bn" : "en"}
                lang={bn ? "bn" : "en"}
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -18, opacity: 0 }}
                transition={{ duration: 0.45, delay: i * 0.08, ease }}
                className="absolute inset-0 flex items-center px-3 text-sm font-medium"
              >
                {bn ? w.bn : w.en}
              </motion.span>
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ROUTES = [
  { icon: UsersRoundIcon, at: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
  { icon: ShoppingBasketIcon, at: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2" },
  { icon: TargetIcon, at: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" },
];
const PACE = [0.48, 0.57, 0.65, 0.72];

/** The goal ring fills as each route to it lights up: more customers, bigger baskets, a daily target. */
function Goals() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useLoop(ref, PACE.length, 1500);
  return (
    <div ref={ref} className="relative mt-2 mb-6 size-52">
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full animate-[spin_40s_linear_infinite] motion-reduce:animate-none">
        <circle cx="100" cy="100" r="99" fill="none" stroke="#3f82ff" strokeOpacity="0.45" strokeDasharray="2 7" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-9 grid place-items-center rounded-full bg-white shadow-[0_20px_40px_-20px_rgb(7_20_71/0.4)] ring-1 ring-[#071447]/[0.06]">
        <svg viewBox="0 0 100 100" className="absolute inset-2 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#0a3cff" strokeOpacity="0.08" strokeWidth="6" />
          <motion.circle cx="50" cy="50" r="44" fill="none" stroke="#0a3cff" strokeWidth="6" strokeLinecap="round" initial={false} animate={{ pathLength: PACE[step] }} transition={{ duration: 1, ease }} />
        </svg>
        <p className="text-center">
          <span className="block font-display text-2xl font-semibold tracking-tight tabular-nums">{Math.round(PACE[step] * 100)}%</span>
          <span className="block text-[11px] text-[#071447]/55">of ৳5L goal</span>
        </p>
      </div>
      {ROUTES.map((r, i) => (
        <Chip key={i} on={step === i} className={cn("absolute", r.at)}>
          <r.icon />
        </Chip>
      ))}
      <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-[0_10px_24px_-12px_rgb(7_20_71/0.35)] ring-1 ring-[#071447]/[0.06]">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        ৳3,200 a day to get there
      </span>
    </div>
  );
}

const POSTS = [
  { icon: PackageIcon, label: "Stock", note: "−2 Coca-Cola" },
  { icon: BookOpenIcon, label: "Books", note: "Sale posted" },
  { icon: InboxIcon, label: "Inbox", note: "Restock in 4 days" },
];

/** A sale flows into POS-sible and fans out: stock, books, then the inbox light up in turn. */
function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useLoop(ref, POSTS.length + 3, 1000); // 0 sale, 1 POS-sible, 2-4 each post, 5 all lit
  return (
    <div ref={ref} className="flex items-center">
      {/* The label hangs below the chip, so the chip itself stays on the line through the logo. */}
      <span className="relative">
        <Chip on={step === 0}><ScanLineIcon /></Chip>
        <span className="absolute top-full left-1/2 mt-2 -translate-x-1/2 text-[11px] font-medium text-[#071447]/55">Sale</span>
      </span>
      <svg viewBox="0 0 40 4" preserveAspectRatio="none" className="h-1 w-6 sm:w-12">
        <path d="M0 2 H40" stroke="#3f82ff" strokeWidth="2" strokeDasharray="4 5" className="wl-flow" />
      </svg>
      <span className={cn("grid size-20 shrink-0 place-items-center rounded-[26px] bg-white shadow-[0_24px_48px_-20px_rgb(10_60_255/0.45)] ring-2 transition-colors duration-500 sm:size-24", step === 1 ? "ring-[#0a3cff]" : "ring-[#9fd0ff]")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative 48px logo, already cached by the nav */}
        <img src="/logo-192.png" alt="" className="size-11 sm:size-12" />
      </span>
      <svg viewBox="0 0 40 132" className="h-[132px] w-6 shrink-0 sm:w-12" preserveAspectRatio="none">
        <g fill="none" stroke="#3f82ff" strokeWidth="2" strokeDasharray="4 5" className="wl-flow">
          <path d="M0 66 C20 66 20 18 40 18" />
          <path d="M0 66 H40" />
          <path d="M0 66 C20 66 20 114 40 114" />
        </g>
      </svg>
      <ul className="grid gap-3">
        {POSTS.map((p, i) => {
          const lit = step >= i + 2;
          return (
            <li key={p.label} className={cn("flex h-9 items-center gap-2 rounded-xl pr-3 pl-1.5 text-xs font-medium ring-1 transition-all duration-500", lit ? "bg-white shadow-[0_10px_24px_-12px_rgb(7_20_71/0.35)] ring-[#0a3cff]/25" : "bg-white/50 text-[#071447]/45 ring-[#071447]/[0.06]")}>
              <span className={cn("grid size-6 place-items-center rounded-lg transition-colors duration-500", lit ? "bg-[#0a3cff] text-white" : "bg-[#071447]/5")}>
                <p.icon className="size-3.5" />
              </span>
              {p.label}
              <span className={cn("hidden whitespace-nowrap text-[#071447]/50 sm:inline", !lit && "opacity-0")}>{p.note}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
