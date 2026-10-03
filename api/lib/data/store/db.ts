import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DB } from "@/lib/data/schemas";
import { createSeed, SEED_VERSION } from "@/lib/data/seed";
import { upgradeRoles } from "@/lib/auth/permissions";
import { stampChanges } from "./audit";
import { dbStorage } from "./storage";

type DBState = { db: DB | null; hydrated: boolean };

/**
 * On the server every request works on its own copy of the business database. `lib/server/context.ts` points
 * `dataContext.current` at that request's context; in the browser it stays empty and the local store below is used.
 */
export type DataContext = { db: DB; userId: string | null; dirty: boolean };
export const dataContext: { current: () => DataContext | undefined } = { current: () => undefined };

export const useDB = create<DBState>()(
  persist((): DBState => ({ db: null, hydrated: false }), {
    name: "posible:v1:db",
    version: SEED_VERSION,
    storage: dbStorage<Pick<DBState, "db">>(),
    partialize: (s) => ({ db: s.db }),
    skipHydration: true,
    // A version bump drops old data; DataGate then reseeds.
    migrate: () => ({ db: null }),
  }),
);

/**
 * Who is acting and what time it is, for the "updated by / at" stamps. The browser session and the clock helper
 * register themselves here (they import this file, so it can't import them).
 */
export const actor: { userId: () => string | null; now: () => string } = {
  userId: () => dataContext.current()?.userId ?? null,
  now: () => new Date().toISOString().slice(0, 19),
};

export function getDB(): DB {
  const ctx = dataContext.current();
  if (ctx) return ctx.db;
  const { db } = useDB.getState();
  if (db) return db;
  const seeded = createSeed();
  useDB.setState({ db: seeded });
  return seeded;
}

/** Copy → mutate → set. Every write goes through here so subscribers always see a new reference. */
export function commit(mutator: (draft: DB) => void): void {
  const before = getDB();
  const draft = structuredClone(before);
  mutator(draft);
  stampChanges(before, draft, actor.userId(), actor.now());
  const ctx = dataContext.current();
  if (ctx) {
    ctx.db = draft;
    ctx.dirty = true;
  } else useDB.setState({ db: draft });
}

export function resetDB(db?: DB): void {
  const next = db ?? createSeed();
  const ctx = dataContext.current();
  if (ctx) {
    ctx.db = next;
    ctx.dirty = true;
  } else useDB.setState({ db: next });
}

/** Rehydrate from storage and seed on first run. Resolves once `hydrated` is true. */
export async function hydrateDB(): Promise<void> {
  await useDB.persist.rehydrate();
  if (!useDB.getState().db) useDB.setState({ db: createSeed() });
  const loaded = useDB.getState().db!;
  const roles = upgradeRoles(loaded.roles);
  if (roles.some((r, i) => r !== loaded.roles[i])) useDB.setState({ db: { ...loaded, roles } });
  useDB.setState({ hydrated: true });
}
