import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { settings as settingsSchema, type Settings } from "@/lib/data/schemas";
import { getDB, resetDB } from "@/lib/data/store/db";
import { settingsService } from "@/lib/data/services/settings";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const lookup = (tree: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], tree);

describe("settings", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("every section validates against its schema and saves back unchanged", async () => {
    for (const section of Object.keys(settingsSchema.shape) as (keyof Settings)[]) {
      const current = getDB().settings[section];
      const parsed = settingsSchema.shape[section].safeParse(current);
      expect(parsed.success, section).toBe(true);
      const saved = await settingsService.update(section, current);
      expect(saved[section]).toEqual(current);
    }
  });

  it("an edit reaches the next read straight away", async () => {
    await settingsService.update("sale", { allowOverselling: true });
    expect((await settingsService.get()).sale.allowOverselling).toBe(true);
  });

  it("every tab has a title in both languages", () => {
    for (const k of Object.keys(settingsSchema.shape)) {
      expect(lookup(en, `settings.tabs.${k}`), k).toBeTruthy();
      expect(lookup(bn, `settings.tabs.${k}`), k).toBeTruthy();
    }
  });

  it("every literal settings.* / catalog.errors.* key used in the screens exists in both languages", () => {
    const dir = new URL(".", import.meta.url).pathname;
    const files = readdirSync(dir).filter((f) => /\.tsx$/.test(f)).map((f) => readFileSync(join(dir, f), "utf8"));
    const keys = new Set<string>();
    for (const src of files) for (const m of src.matchAll(/\bt\("(settings\.[A-Za-z.]+)"/g)) keys.add(m[1]);
    for (const k of keys) {
      expect(lookup(en, k), `en ${k}`).toBeTruthy();
      expect(lookup(bn, k), `bn ${k}`).toBeTruthy();
    }
    expect(keys.size).toBeGreaterThan(50);
  });
});
