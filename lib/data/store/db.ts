import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DB } from "@/lib/data/schemas";
import { createSeed, SEED_VERSION } from "@/lib/data/seed";
import { safeStorage } from "./storage";

type DBState = { db: DB | null; hydrated: boolean };

export const useDB = create<DBState>()(
  persist((): DBState => ({ db: null, hydrated: false }), {
    name: "posible:v1:db",
    version: SEED_VERSION,
    storage: safeStorage<Pick<DBState, "db">>(),
    partialize: (s) => ({ db: s.db }),
    skipHydration: true,
    // A version bump drops old data; DataGate then reseeds.
    migrate: () => ({ db: null }),
  }),
);

export function getDB(): DB {
  const { db } = useDB.getState();
  if (db) return db;
  const seeded = createSeed();
  useDB.setState({ db: seeded });
  return seeded;
}

/** Copy → mutate → set. Every write goes through here so subscribers always see a new reference. */
export function commit(mutator: (draft: DB) => void): void {
  const draft = structuredClone(getDB());
  mutator(draft);
  useDB.setState({ db: draft });
}

export function resetDB(db?: DB): void {
  useDB.setState({ db: db ?? createSeed() });
}

/** Rehydrate from storage and seed on first run. Resolves once `hydrated` is true. */
export async function hydrateDB(): Promise<void> {
  await useDB.persist.rehydrate();
  if (!useDB.getState().db) useDB.setState({ db: createSeed() });
  useDB.setState({ hydrated: true });
}
