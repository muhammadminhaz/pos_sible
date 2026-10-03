"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatHotkey } from "@/lib/pos/hotkeys";

/** Turns a keydown into a "ctrl+shift+x" spec; null for a bare modifier press. */
export function chordFromEvent(e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const parts = [e.ctrlKey && "ctrl", e.altKey && "alt", e.metaKey && "meta", e.shiftKey && e.key.length > 1 && "shift"].filter(Boolean) as string[];
  return [...parts, e.key.toLowerCase()].join("+");
}

/** Which actions share a chord with another action. */
export function shortcutConflicts(map: Record<string, string>): Set<string> {
  const seen = new Map<string, string[]>();
  for (const [k, v] of Object.entries(map)) if (v) seen.set(v, [...(seen.get(v) ?? []), k]);
  return new Set([...seen.values()].filter((ks) => ks.length > 1).flat());
}

const humanize = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function ShortcutEditor({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const t = useTranslations("settings");
  const [recording, setRecording] = useState<string | null>(null);
  const bad = shortcutConflicts(value);
  return (
    <fieldset className="col-span-full rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">{t("shortcuts")}</legend>
      <p className="mb-3 text-xs text-muted-foreground">{t("shortcutsHint")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(value).map(([k, chord]) => (
          <div key={k} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
            <span className="text-sm">{t.has(`fields.pos.shortcuts.${k}`) ? t(`fields.pos.shortcuts.${k}`) : humanize(k)}</span>
            <Button
              type="button" size="sm" variant={bad.has(k) ? "destructive" : "outline"}
              aria-label={`${humanize(k)}: ${formatHotkey(chord)}`}
              onClick={() => setRecording(k)}
              onBlur={() => setRecording((r) => (r === k ? null : r))}
              onKeyDown={(e) => {
                if (recording !== k) return;
                e.preventDefault();
                if (e.key === "Escape") return setRecording(null);
                const c = chordFromEvent(e);
                if (!c) return;
                onChange({ ...value, [k]: c });
                setRecording(null);
              }}
            >
              {recording === k ? t("pressKeys") : formatHotkey(chord) || "—"}
            </Button>
          </div>
        ))}
      </div>
      {bad.size > 0 && <p role="alert" className="mt-2 text-sm text-destructive">{t("shortcutConflict")}</p>}
    </fieldset>
  );
}
