"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon, MailIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

type NavLink = { href: string; label: string };

/**
 * The black notch hanging from the card's top edge. From 1024px: logo, centered links and Contact.
 * Below that it spans the card like the reference: logo and a menu button, and the notch unfolds over the hero into the menu: the links, then a full-width Contact.
 */
export function WelcomeNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const outside = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("keydown", key);
    addEventListener("pointerdown", outside);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("pointerdown", outside);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <nav ref={ref} aria-label="Main" className="wl-drop absolute inset-x-0 top-0 mx-auto w-full max-w-4xl rounded-b-[24px] bg-[#05050a] p-2 sm:p-2.5 lg:w-[calc(100%-4rem)] lg:rounded-b-[28px]">
      <NotchCorner side="left" />
      <NotchCorner side="right" />
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex h-12 shrink-0 items-center gap-2.5 rounded-full pr-3 pl-1.5 font-display text-[15px] font-semibold tracking-tight">
          <Image src="/logo-192.png" alt="" width={32} height={32} className="rounded-full" />
          {SITE.name}
        </Link>
        <ul className="absolute left-1/2 hidden h-12 -translate-x-1/2 items-stretch gap-1 py-1 lg:flex">
          {links.map((n) => (
            <li key={n.href} className="flex">
              <NavPill href={n.href} label={n.label} />
            </li>
          ))}
        </ul>
        <ContactPill className="hidden lg:inline-flex" />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="wl-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="relative grid size-12 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
        >
          <span aria-hidden className={cn("absolute h-[1.5px] w-6 rounded-full bg-white transition-transform duration-300 ease-[var(--wl-ease)]", open ? "rotate-45" : "-translate-y-[4px]")} />
          <span aria-hidden className={cn("absolute h-[1.5px] w-6 rounded-full bg-white transition-transform duration-300 ease-[var(--wl-ease)]", open ? "-rotate-45" : "translate-y-[4px]")} />
        </button>
      </div>

      {/* Rows animate 0fr to 1fr, so the notch grows to fit the menu without measuring it. */}
      <div id="wl-menu" inert={!open} className={cn("grid transition-[grid-template-rows] duration-500 ease-[var(--wl-ease)] motion-reduce:transition-none lg:hidden", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <ul className="px-3 pt-3">
            {links.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={close} className="flex h-14 items-center justify-between border-b border-white/10 text-[15px] font-medium text-white/90 transition-colors hover:text-white">
                  {n.label}
                  <ArrowUpRightIcon aria-hidden className="size-4 text-white/40" />
                </a>
              </li>
            ))}
          </ul>
          <div className="px-3 pt-5 pb-2">
            <ContactPill onClick={close} className="flex w-full justify-center text-[15px]" />
          </div>
        </div>
      </div>
    </nav>
  );
}

/** After React Bits' GlareHover: one soft streak of light crosses the pill on hover. */
function ContactPill({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <a href="#contact" onClick={onClick} className={cn("group relative h-12 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-white px-5 text-sm font-semibold text-[#05050a] transition-transform active:scale-[0.98]", className)}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgb(10_60_255/0.18),transparent)] transition-transform duration-700 ease-out group-hover:translate-x-[300%] motion-reduce:hidden" />
      <MailIcon aria-hidden className="size-4 text-[#0a3cff]" />
      Contact
    </a>
  );
}

/** Concave fillet that blends the notch into the bezel's top edge, as if both were cut from one piece. Only needed when the notch is narrower than the card. */
function NotchCorner({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-0 hidden size-7 lg:block",
        side === "left"
          ? "right-full bg-[radial-gradient(circle_at_0_100%,transparent_27.5px,#05050a_28px)]"
          : "left-full bg-[radial-gradient(circle_at_100%_100%,transparent_27.5px,#05050a_28px)]",
      )}
    />
  );
}

/** Nav link in the style of React Bits' PillNav: a dome rises from the bottom on hover while the label slides up and a dark copy slides in. CSS only. */
function NavPill({ href, label }: { href: string; label: string }) {
  const slide = "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
  return (
    <a href={href} className="group relative flex items-center overflow-hidden rounded-full px-4 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70">
      <span aria-hidden className={cn("absolute top-full left-1/2 aspect-square w-[160%] -translate-x-1/2 rounded-full bg-white", slide, "group-hover:-translate-y-[62%] group-focus-visible:-translate-y-[62%]")} />
      <span className="relative block">
        <span className={cn("block", slide, "group-hover:-translate-y-[160%] group-focus-visible:-translate-y-[160%]")}>{label}</span>
        <span aria-hidden className={cn("absolute inset-0 block translate-y-[160%] text-[#05050a]", slide, "group-hover:translate-y-0 group-focus-visible:translate-y-0")}>{label}</span>
      </span>
    </a>
  );
}
