"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import "./branched-nav.css";

export type BranchedKid = { key: string; href: string; label: string };
export type BranchedSection = { key: string; label: string; icon: LucideIcon; href?: string; kids?: BranchedKid[] };

const PAD = 6;
const MARK = 16;

/**
 * The sidebar's tree: sections fold open, and a line is drawn from the rail along a branch to the page you're on.
 * Adapted from React Bits' "Branched Menu": same geometry and motion, but driven by the app's own state (which
 * section is open, which page is active) and made of real links, so keyboard, middle-click and prefetch all work.
 */
export function BranchedNav({
  sections, activeSection, activeKid, isOpen, onToggle, onNavigate, rowHeight = 30, indent = 36, trunk = 12, radius = 9,
}: {
  sections: BranchedSection[];
  /** Key of the section holding the current page (or the current top-level link). */
  activeSection: string | undefined;
  activeKid: string | undefined;
  isOpen: (sectionKey: string) => boolean;
  onToggle: (sectionKey: string) => void;
  onNavigate: () => void;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
}) {
  const navRef = useRef<HTMLElement>(null);
  const heads = useRef<Record<string, HTMLElement | null>>({});
  const markerRef = useRef<HTMLSpanElement>(null);

  const markerShown = activeSection !== undefined && (sections.find((s) => s.key === activeSection)?.kids ? isOpen(activeSection) : true);
  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current;
      const el = activeSection ? heads.current[activeSection] : null;
      if (!m) return;
      const on = markerShown && el;
      if (!glide) m.style.transition = "none";
      if (on) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      m.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void m.offsetHeight; // commit the jump before transitions come back
        m.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) return void (first = false);
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, sections.length]);

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k: number) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k: number) => `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k: number) => `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k: number) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  return (
    <nav ref={navRef} className="branched-menu" style={{ "--bm-row": `${rowHeight}px`, "--bm-indent": `${indent}px` } as CSSProperties}>
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {sections.map((s) => {
        const Icon = s.icon;
        if (!s.kids) {
          const current = s.key === activeSection;
          return (
            <div key={s.key} className="branched-menu__section">
              <Link ref={(el) => void (heads.current[s.key] = el)} href={s.href!} onClick={onNavigate} className="branched-menu__head" aria-current={current ? "page" : undefined} data-current={current ? "" : undefined}>
                <Icon aria-hidden />
                <span className="branched-menu__label">{s.label}</span>
              </Link>
            </div>
          );
        }
        const open = isOpen(s.key);
        const kids = s.kids;
        const bodyH = PAD * 2 + kids.length * rowHeight;
        return (
          <div key={s.key} className="branched-menu__section" data-open={open ? "" : undefined}>
            <button ref={(el) => void (heads.current[s.key] = el)} type="button" className="branched-menu__head" aria-expanded={open} data-current={s.key === activeSection ? "" : undefined} onClick={() => onToggle(s.key)}>
              <Icon aria-hidden />
              <span className="branched-menu__label">{s.label}</span>
              <ChevronRightIcon className="branched-menu__chev" aria-hidden />
            </button>
            <div className="branched-menu__body">
              <div className="branched-menu__fold" inert={!open}>
                <div className="branched-menu__tree" style={{ height: bodyH }}>
                  <svg className="branched-menu__lines" width={indent} height={bodyH} aria-hidden="true">
                    <path className="branched-menu__base" d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`} />
                    {kids.map((kid, k) => <path key={kid.key} className="branched-menu__base" d={branch(k)} />)}
                    {kids.map((kid, k) => (
                      <path key={kid.key} className="branched-menu__reach" d={reach(k)} style={{ strokeDasharray: length(k), strokeDashoffset: kid.key === activeKid ? 0 : length(k) }} />
                    ))}
                  </svg>
                  {kids.map((kid) => (
                    <Link key={kid.key} href={kid.href} onClick={onNavigate} className="branched-menu__item" aria-current={kid.key === activeKid ? "page" : undefined} data-active={kid.key === activeKid ? "" : undefined}>
                      <span className="branched-menu__label">{kid.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
