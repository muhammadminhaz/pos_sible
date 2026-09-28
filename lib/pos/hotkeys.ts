"use client";

import { useEffect, useRef } from "react";

export type Hotkey = { key: string; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
export type KeyLike = { key: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean };

export function parseHotkey(spec: string): Hotkey | null {
  const parts = spec.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  return { key, shift: parts.includes("shift"), ctrl: parts.includes("ctrl"), alt: parts.includes("alt"), meta: parts.includes("meta") };
}

const printable = (k: string) => k.length === 1 && !/[a-z0-9]/.test(k);

export function matchHotkey(e: KeyLike, spec: string): boolean {
  const h = parseHotkey(spec);
  if (!h || e.key.toLowerCase() !== h.key) return false;
  const shiftOk = printable(h.key) || e.shiftKey === h.shift;
  return shiftOk && e.ctrlKey === h.ctrl && e.altKey === h.alt && e.metaKey === h.meta;
}

export function formatHotkey(spec: string): string {
  return spec
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join(" + ");
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Window-level shortcuts. While typing in a field only function keys, Escape and
 * modifier combos fire, so "?" or "e" can still be typed into inputs.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      for (const [spec, fn] of Object.entries(ref.current)) {
        if (!spec || !matchHotkey(e, spec)) continue;
        const h = parseHotkey(spec)!;
        const fnKey = /^f\d{1,2}$/.test(h.key) || h.key === "escape";
        if (isTyping(e.target) && !fnKey && !h.ctrl && !h.alt && !h.meta && !(h.shift && h.key.length === 1 && /[a-z]/.test(h.key))) continue;
        e.preventDefault();
        fn(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
