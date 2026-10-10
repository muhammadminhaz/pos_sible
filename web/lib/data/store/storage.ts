import { createJSONStorage, type StateStorage } from "zustand/middleware";

const memory = (): StateStorage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
};

/** localStorage in the browser, an in-memory map in node (tests, SSR). */
export const safeStorage = <S>() =>
  createJSONStorage<S>(() => (typeof window === "undefined" ? memory() : window.localStorage));

const REMEMBER_KEY = "posible:v1:remember";

/** Where the sign-in lives: localStorage when "Remember me" is on, sessionStorage (gone with the tab) when off. */
export function chooseSessionStore(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    // Drop the copy in the store we're leaving so a stale sign-in can't resurface.
    (remember ? window.sessionStorage : window.localStorage).removeItem("posible:v1:session");
  } catch {
    /* storage blocked: the in-memory session still works for this tab */
  }
}

/** Resolved on every call, so flipping "Remember me" at sign-in takes effect without a reload. */
export const sessionStorageChoice = <S>() => {
  const fallback = memory();
  const pick = (): StateStorage => {
    if (typeof window === "undefined") return fallback;
    try {
      return window.localStorage.getItem(REMEMBER_KEY) === "0" ? window.sessionStorage : window.localStorage;
    } catch {
      return fallback;
    }
  };
  return createJSONStorage<S>(() => ({
    getItem: (k) => pick().getItem(k),
    setItem: (k, v) => pick().setItem(k, v),
    removeItem: (k) => pick().removeItem(k),
  }));
};

/** Deletes one stored database (and any copy parked during unload). Used to wipe the demo shop. */
export async function removeStoredDb(name: string): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  try { window.localStorage.removeItem(`${name}:unsaved`); } catch { /* storage blocked */ }
  try { await idbRun("readwrite", (s) => s.delete(name)); } catch { /* nothing stored */ }
}

// ---- Database storage: IndexedDB, so a busy shop never hits localStorage's ~5 MB ceiling -----------------------

const IDB_NAME = "posible";
const IDB_STORE = "kv";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openIdb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, mode);
        const req = fn(tx.objectStore(IDB_STORE));
        tx.oncomplete = () => { db.close(); resolve(req.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
      }),
  );
}

export type StorageHealth = { ok: boolean; reason: string | null };
let healthListeners: ((h: StorageHealth) => void)[] = [];
let health: StorageHealth = { ok: true, reason: null };
export const storageHealth = {
  get: () => health,
  subscribe(fn: (h: StorageHealth) => void) {
    healthListeners.push(fn);
    return () => void (healthListeners = healthListeners.filter((x) => x !== fn));
  },
};
const setHealth = (h: StorageHealth) => { health = h; healthListeners.forEach((f) => f(h)); };

/**
 * The business database. Reads fall back to the old localStorage copy once (and move it over); writes are
 * coalesced for 100 ms and flushed when the tab is hidden, so a burst of edits is one write. If a write fails,
 * `storageHealth` says so and the app tells the user instead of losing data silently.
 */
export const dbStorage = <S>() => {
  const fallback = memory();
  const usable = typeof window !== "undefined" && typeof indexedDB !== "undefined";
  let pending: { name: string; value: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    const job = pending;
    pending = null;
    if (!job) return;
    try {
      await idbRun("readwrite", (s) => s.put(job.value, job.name));
      try { window.localStorage.removeItem(parked(job.name)); } catch { /* nothing parked */ }
      if (!health.ok) setHealth({ ok: true, reason: null });
    } catch (e) {
      setHealth({ ok: false, reason: e instanceof Error ? e.message : "write failed" });
    }
  };
  // An IndexedDB write started while the page is unloading can be cut off, so unsaved data is also parked in
  // localStorage (synchronous) and picked up on the next load.
  const parked = (name: string) => `${name}:unsaved`;
  const park = () => {
    if (!pending) return;
    try { window.localStorage.setItem(parked(pending.name), pending.value); } catch { /* too big: the IndexedDB write is the only hope */ }
  };
  if (usable) {
    window.addEventListener("pagehide", () => { park(); void flush(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { park(); void flush(); } });
  }

  const state: StateStorage = usable
    ? {
        async getItem(name) {
          try {
            const unsaved = window.localStorage.getItem(parked(name));
            if (unsaved != null) {
              await idbRun("readwrite", (s) => s.put(unsaved, name));
              window.localStorage.removeItem(parked(name));
              return unsaved;
            }
            const v = await idbRun<string | undefined>("readonly", (s) => s.get(name));
            if (v != null) return v;
            // First run after the upgrade: adopt the localStorage copy.
            const legacy = window.localStorage.getItem(name);
            if (legacy != null) {
              await idbRun("readwrite", (s) => s.put(legacy, name));
              window.localStorage.removeItem(name);
            }
            return legacy;
          } catch {
            setHealth({ ok: false, reason: "IndexedDB is unavailable" });
            return window.localStorage.getItem(name);
          }
        },
        setItem(name, value) {
          pending = { name, value };
          if (!timer) timer = setTimeout(() => void flush(), 100);
        },
        async removeItem(name) {
          pending = null;
          try { await idbRun("readwrite", (s) => s.delete(name)); } catch { /* nothing stored */ }
        },
      }
    : fallback;
  return createJSONStorage<S>(() => state);
};
