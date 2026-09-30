import { describe, expect, it } from "vitest";
import { formatHotkey, matchHotkey, parseHotkey, shouldFire } from "./hotkeys";

const ev = (key: string, mods: Partial<Record<"shiftKey" | "ctrlKey" | "altKey" | "metaKey", boolean>> = {}) => ({
  key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods,
});

describe("hotkeys", () => {
  it("parses modifiers and key", () => {
    expect(parseHotkey("Shift+E")).toEqual({ key: "e", shift: true, ctrl: false, alt: false, meta: false });
    expect(parseHotkey("f2")).toEqual({ key: "f2", shift: false, ctrl: false, alt: false, meta: false });
    expect(parseHotkey("")).toBeNull();
  });
  it("matches events case-insensitively with exact modifiers", () => {
    expect(matchHotkey(ev("E", { shiftKey: true }), "shift+e")).toBe(true);
    expect(matchHotkey(ev("e"), "shift+e")).toBe(false);
    expect(matchHotkey(ev("F2"), "f2")).toBe(true);
    expect(matchHotkey(ev("F2", { ctrlKey: true }), "f2")).toBe(false);
    expect(matchHotkey(ev("?", { shiftKey: true }), "?")).toBe(true); // printable symbols ignore shift
  });
  it("formats for display", () => {
    expect(formatHotkey("shift+e")).toBe("Shift + E");
    expect(formatHotkey("f4")).toBe("F4");
  });
  it("suppresses a shift-letter hotkey while typing in a field, but fires it elsewhere", () => {
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    const body = { tagName: "BODY" } as unknown as EventTarget;
    expect(shouldFire("shift+f", input)).toBe(false);
    expect(shouldFire("shift+f", body)).toBe(true);
  });
  it("fires shift+letter from a number input, which can't receive letters", () => {
    const num = { tagName: "INPUT", type: "number" } as unknown as EventTarget;
    const text = { tagName: "INPUT", type: "text" } as unknown as EventTarget;
    expect(shouldFire("shift+f", num)).toBe(true);
    expect(shouldFire("shift+f", text)).toBe(false);
  });
  it("still fires function keys, Escape, and ctrl/alt/meta combos while typing", () => {
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    expect(shouldFire("f2", input)).toBe(true);
    expect(shouldFire("escape", input)).toBe(true);
    expect(shouldFire("ctrl+shift+f", input)).toBe(true);
  });
});
