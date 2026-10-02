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

// Duck-typed rather than `instanceof HTMLElement`, so it also works against a plain mock
// target in tests without a DOM.
type TypingTarget = { tagName?: string; isContentEditable?: boolean };
const isTyping = (t: EventTarget | null) => {
  const el = t as TypingTarget | null;
  return !!el && (!!el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName ?? ""));
};

/**
 * True when `spec` should fire for `target`: function keys, Escape, and ctrl/alt/meta
 * combos always fire; everything else — including a shift-only letter or symbol — is
 * suppressed while typing in a field, so ordinary characters (capitals included) reach
 * the field instead of triggering the hotkey.
 */
export function shouldFire(spec: string, target: EventTarget | null): boolean {
  const h = parseHotkey(spec);
  if (!h) return false;
  const fnKey = /^f\d{1,2}$/.test(h.key) || h.key === "escape";
  // A number field can't take letters, so a letter hotkey may fire from it (the autofocused payment amount, quantity cells).
  // Characters a number field does accept (digits, . + - e ,) must still reach the field.
  const numeric = (target as { type?: string } | null)?.type === "number" && !/^[0-9.+\-e,]$/.test(h.key);
  return fnKey || h.ctrl || h.alt || h.meta || numeric || !isTyping(target);
}

/**
 * Window-level shortcuts. While typing in a field, only function keys, Escape, and
 * ctrl/alt/meta combos fire, so ordinary characters — including shift-capitals — can
 * still be typed into inputs.
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
        if (!spec || !matchHotkey(e, spec) || !shouldFire(spec, e.target)) continue;
        e.preventDefault();
        fn(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
