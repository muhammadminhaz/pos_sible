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
