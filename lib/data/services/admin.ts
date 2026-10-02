import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { AppError, ValidationError } from "@/lib/data/errors";
import { assertCan } from "@/lib/auth/assertCan";
import { useSession } from "@/lib/auth/session";
import type { Backup, DB, User } from "@/lib/data/schemas";
import { SEED_VERSION } from "@/lib/data/seed";
import { delay, nowISO, uid } from "./_util";

const REQUIRED_TABLES = ["locations", "roles", "users", "products", "transactions", "invoiceSchemes"] as const;

/** Throws if `db` isn't a complete backup. Nothing is applied before this passes. */
export function validateBackup(db: unknown): asserts db is DB {
  const d = db as DB | null;
  const ok =
    !!d?.meta && d.meta.version === SEED_VERSION && !!d.settings && REQUIRED_TABLES.every((k) => Array.isArray(d[k])) && d.users.length > 0 && d.locations.length > 0;
  if (!ok) throw new AppError("That file isn't a backup from this version of the app.", "invalid_backup");
}

function parse(json: string): DB {
  let db: unknown;
  try {
    db = JSON.parse(json);
  } catch {
    throw new AppError("That file isn't valid JSON.", "invalid_backup");
  }
  validateBackup(db);
  return db;
}

export const backupsService = {
  async list(): Promise<Backup[]> {
    await delay();
    return [...getDB().backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  /** Snapshots the database (without the backup list itself) into a new backup row. */
  async create(name?: string): Promise<Backup> {
    await delay();
    assertCan("backup");
    const { backups: _omit, ...rest } = getDB();
    void _omit;
    const data = JSON.stringify({ ...rest, backups: [] });
    const row = { id: uid("bak"), createdAt: nowISO(), createdBy: useSession.getState().userId, name: name?.trim() || `backup-${nowISO().slice(0, 10)}`, size: data.length, payload: data } as Backup;
    commit((d) => void d.backups.push(row));
    return row;
  },
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("backup");
    commit((d) => void (d.backups = d.backups.filter((b) => b.id !== id)));
  },
  /** Validates first, then replaces everything in one step; the existing backup list is kept. */
  async restore(json: string): Promise<void> {
    await delay();
    assertCan("backup");
    const db = parse(json);
    const keep = getDB().backups;
    resetDB({ ...db, backups: keep });
  },
  async restoreFrom(id: string): Promise<void> {
    const row = getDB().backups.find((b) => b.id === id);
    if (!row) throw new AppError("Backup not found.", "not_found");
    return this.restore(row.payload);
  },
};

export const accountService = {
  /** Changing a password needs the current one. */
  async changePassword(current: string, next: string): Promise<void> {
    await delay();
    const id = useSession.getState().userId;
    const me = getDB().users.find((u) => u.id === id);
    if (!me) throw new AppError("Not signed in.", "forbidden");
    if (me.password !== current) throw new ValidationError({ current: "wrong" });
    if (next.length < 6) throw new ValidationError({ next: "too_short" });
    commit((d) => void (d.users.find((u) => u.id === id)!.password = next));
  },
  async updateProfile(patch: Partial<User>): Promise<void> {
    await delay();
    const id = useSession.getState().userId;
    commit((d) => {
      const u = d.users.find((x) => x.id === id);
      if (!u) throw new AppError("Not signed in.", "forbidden");
      // Role, locations and login flags are admin-only.
      const { id: _i, roleId: _r, locationIds: _l, isActive: _a, allowLogin: _w, username: _u, password: _p, ...safe } = patch;
      void [_i, _r, _l, _a, _w, _u, _p];
      Object.assign(u, safe);
    });
  },
};
