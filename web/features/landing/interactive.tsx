"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { API_MODE } from "@/lib/data/api/mode";
import { useCountUp } from "@/lib/useCountUp";
import { cn } from "@/lib/utils";
import { GET_STARTED_HREF, GROWTH, PLANS, PLAN_FEATURES, PRICING } from "./content";
import { PnlMock, PosMock, StockMock, TransfersMock } from "./mockups";

/** Fades a block up once as it scrolls into view. Reduced motion only shortens the transition, so server and client markup match. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up from zero the first time it is seen. */
export function StatCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const n = useCountUp(seen ? value : 0, 900);
  return (
    <span ref={ref} className="tabular-nums">
      {Math.round(n ?? value)}
    </span>
  );
}

/** Demo mode keeps the session in the browser, so a signed-in visitor is sent on to the app once it has loaded. */
export function SignedInRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (API_MODE) return;
    let off = () => {};
    void import("@/lib/auth/session").then(({ useSession }) => {
      const go = () => useSession.getState().userId && router.replace("/home");
      if (useSession.persist.hasHydrated()) go();
      else off = useSession.persist.onFinishHydration(go);
    });
    return () => off();
  }, [router]);
  return null;
}

const PANELS = { checkout: <PosMock />, stock: <TransfersMock />, reports: <PnlMock /> } as const;
const SIDE = { checkout: null, stock: <StockMock />, reports: null } as const;

export function GrowthTabs() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const last = GROWTH.tabs.length - 1;
  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };
  const tab = GROWTH.tabs[active];
  const side = SIDE[tab.id as keyof typeof SIDE];
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Product areas" className="mx-auto flex flex-wrap justify-center gap-1 rounded-full bg-white/15 p-1">
        {GROWTH.tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`growth-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls="growth-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "h-10 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              i === active ? "bg-white text-zinc-900 shadow-sm" : "text-white/90 hover:bg-white/10",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="growth-panel" role="tabpanel" aria-labelledby={`growth-tab-${tab.id}`} className="rounded-3xl bg-background p-4 text-foreground shadow-2xl shadow-primary/30 sm:p-6">
        <p className="mb-4 text-sm text-muted-foreground">{tab.body}</p>
        <div className={cn("grid gap-3", side && "md:grid-cols-[1.4fr_1fr]")}>
          {PANELS[tab.id as keyof typeof PANELS]}
          {side}
        </div>
      </div>
    </div>
  );
}

const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;

export function PricingPlans() {
  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const featured = "featured" in p && p.featured;
          return (
            <div
              key={p.id}
              className={cn(
                "landing-lift flex flex-col rounded-[28px] border p-7 shadow-[0_1px_2px_rgb(0_0_0/.04),0_12px_32px_-16px_rgb(11_12_43/.18)]",
                featured ? "border-transparent bg-zinc-950 text-zinc-50 dark:border-border" : "bg-card hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">{p.label}</h3>
                {featured && <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{PRICING.best}</span>}
              </div>
              <p className={cn("mt-3 flex items-baseline gap-1.5 font-display", featured ? "text-zinc-50" : "text-foreground")}>
                <span className="text-4xl font-semibold tabular-nums tracking-tight">{money(p.price)}</span>
                <span className={cn("text-sm", featured ? "text-zinc-400" : "text-muted-foreground")}>/month</span>
              </p>
              <p className={cn("mt-3 text-sm", featured ? "text-zinc-400" : "text-muted-foreground")}>{p.blurb}</p>
              <Link
                href={GET_STARTED_HREF}
                className={cn(buttonVariants({ variant: featured ? "default" : "outline" }), "mt-6 h-12 w-full rounded-xl text-[15px]")}
              >
                Choose {p.label}
              </Link>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-center gap-2.5 font-medium">
                  <CheckIcon className="size-4 shrink-0 text-primary" /> {p.usersLabel}
                </li>
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className={cn("flex items-center gap-2.5", featured ? "text-zinc-300" : "text-muted-foreground")}>
                    <CheckIcon className="size-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
