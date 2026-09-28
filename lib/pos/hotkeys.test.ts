import { describe, expect, it } from "vitest";
import { formatHotkey, matchHotkey, parseHotkey } from "./hotkeys";

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
});
