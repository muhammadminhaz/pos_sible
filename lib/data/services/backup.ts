import type { DB } from "@/lib/data/schemas";
import { getDB, resetDB } from "@/lib/data/store/db";
import { SEED_VERSION } from "@/lib/data/seed";
import { AppError } from "@/lib/data/errors";

export const backupService = {
  exportJSON(): string {
    return JSON.stringify(getDB());
  },
  importJSON(json: string): void {
    let db: DB;
    try {
      db = JSON.parse(json);
    } catch {
      throw new AppError("That file isn't valid JSON.", "invalid_backup");
    }
    if (!db?.meta || db.meta.version !== SEED_VERSION || !Array.isArray(db.products) || !db.settings) {
      throw new AppError("That file isn't a backup from this version of the app.", "invalid_backup");
    }
    resetDB(db);
  },
  reset(): void {
    resetDB();
  },
};
