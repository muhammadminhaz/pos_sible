"use client";

import { useEffect } from "react";

const IDLE_MS = 1200;
/** Pixels from an edge where reaching for a scrollbar brings it back. */
const EDGE = 24;

const scrollable = (el: Element) => {
  const s = getComputedStyle(el);
  return (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) || (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1);
};

/**
 * Scrollbars, vertical and horizontal, on the page and inside tables, lists and panels, are drawn in the accent colour
 * and fade away when nothing has scrolled for a moment. They fade back in on any scroll, or when the pointer goes to the
 * edge to grab one. Scrolling itself is the browser's own. Renders nothing; the look lives in globals.css under `[data-scrolling]`.
 */
export function ScrollbarFade() {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
    const held = new WeakSet<Element>();
    const hide = (el: Element) => { if (!held.has(el)) el.removeAttribute("data-scrolling"); };
    const show = (el: Element) => {
      el.setAttribute("data-scrolling", "");
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => hide(el), IDLE_MS));
    };
    const root = document.documentElement;
    const onScroll = (e: Event) => {
      const t = e.target;
      show(t instanceof Element ? t : root);
      if (!(t instanceof Element)) show(document.body);
    };
    const near = new Set<Element>();
    const onMove = (e: MouseEvent) => {
      const now = new Set<Element>();
      if (e.clientX >= window.innerWidth - EDGE || e.clientY >= window.innerHeight - EDGE) now.add(root);
      let el: Element | null = e.target instanceof Element ? e.target : null;
      for (let depth = 0; el && el !== document.body && depth < 8; el = el.parentElement, depth++) {
        if (!scrollable(el)) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.right - EDGE || e.clientY >= r.bottom - EDGE) now.add(el);
      }
      for (const el of now) if (!near.has(el)) { held.add(el); show(el); }
      for (const el of near) if (!now.has(el)) { held.delete(el); timers.set(el, setTimeout(() => hide(el), IDLE_MS)); }
      near.clear();
      for (const el of now) near.add(el);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("wheel", () => show(root), { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    show(root);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("mousemove", onMove);
      document.querySelectorAll("[data-scrolling]").forEach((el) => el.removeAttribute("data-scrolling"));
    };
  }, []);
  return null;
}
