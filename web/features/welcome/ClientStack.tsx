"use client";

import { useRef, useSyncExternalStore } from "react";
import { useInView } from "motion/react";
import { CakeSlice, Pill, Shirt, ShoppingBasket, Smartphone, type LucideIcon } from "lucide-react";
import Stack from "@/components/ui/stack";
import { useStill } from "./Features";

const SEATS: { n: string; kind: string; icon: LucideIcon; bg: string }[] = [
  { n: "01", kind: "Grocery", icon: ShoppingBasket, bg: "bg-[linear-gradient(150deg,#0a3cff,#3f82ff)]" },
  { n: "02", kind: "Pharmacy", icon: Pill, bg: "bg-[linear-gradient(150deg,#0b2bb8,#0a3cff)]" },
  { n: "03", kind: "Fashion", icon: Shirt, bg: "bg-[linear-gradient(150deg,#1a4fff,#6aa8ff)]" },
  { n: "04", kind: "Electronics", icon: Smartphone, bg: "bg-[linear-gradient(150deg,#071447,#0a3cff)]" },
  { n: "05", kind: "Bakery", icon: CakeSlice, bg: "bg-[linear-gradient(150deg,#2a62ff,#9fd0ff)]" },
];

const noop = () => () => {};

/** React Bits' Stack dealing the founding seats on a loop. Autoplay runs only while it is on screen and motion is allowed. */
export function ClientStack() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { amount: 0.3 });
  const reduce = useStill();
  // Stack places its cards from motion's reduced-motion setting on first render, which the server can't know; draw it in the browser only.
  const client = useSyncExternalStore(noop, () => true, () => false);

  const cards = SEATS.map((s) => (
    <div key={s.n} className={`flex h-full flex-col justify-between p-5 text-white ${s.bg}`}>
      <div className="flex items-start justify-between">
        <span className="font-mono text-xs tracking-wide text-white/80">FOUNDING SHOP #{s.n}</span>
        <s.icon aria-hidden className="size-5 text-white/90" />
      </div>
      <div className="grid size-16 place-items-center self-center rounded-2xl border border-dashed border-white/50 font-mono text-[11px] text-white/80" aria-hidden>your logo</div>
      <div>
        <p className="font-display text-2xl font-semibold tracking-tight">{s.kind}</p>
        <p className="text-sm text-white/75">Seat open</p>
      </div>
    </div>
  ));

  return (
    <div ref={ref} className="mx-auto w-full max-w-[260px] text-[#071447] lg:mx-0 lg:w-[300px] lg:max-w-none">
      <div className="aspect-[4/5] w-full">
        {client && <Stack cards={cards} layout="pile" spread={0.5} radius={24} visible={4} autoplay={seen && !reduce} autoplayDelay={2400} pauseOnHover sendToBackOnClick />}
      </div>
    </div>
  );
}
