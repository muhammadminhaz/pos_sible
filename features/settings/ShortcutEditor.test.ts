import { describe, expect, it } from "vitest";
import { chordFromEvent, shortcutConflicts } from "./ShortcutEditor";

const ev = (key: string, m: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...m });

describe("shortcut editor", () => {
  it("records a chord and ignores bare modifiers", () => {
    expect(chordFromEvent(ev("F9"))).toBe("f9");
    expect(chordFromEvent(ev("s", { ctrlKey: true, shiftKey: true }))).toBe("ctrl+s");
    expect(chordFromEvent(ev("Enter", { shiftKey: true }))).toBe("shift+enter");
    expect(chordFromEvent(ev("Control", { ctrlKey: true }))).toBeNull();
  });
  it("flags every action that shares a chord", () => {
    expect([...shortcutConflicts({ a: "f2", b: "f3", c: "f2", d: "" })].sort()).toEqual(["a", "c"]);
    expect(shortcutConflicts({ a: "f2", b: "f3" }).size).toBe(0);
  });
});
