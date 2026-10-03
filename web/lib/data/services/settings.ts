import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import type { Settings } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { delay } from "./_util";

export const settingsService = service("settingsService", {
  async get(): Promise<Settings> {
    await delay();
    return getDB().settings;
  },
  /** Shallow-merges one settings tab. */
  async update<K extends keyof Settings>(section: K, patch: Partial<Settings[K]>): Promise<Settings> {
    await delay();
    assertCan("settings.business");
    commit((d) => {
      d.settings[section] = { ...d.settings[section], ...patch };
    });
    return getDB().settings;
  },
});
