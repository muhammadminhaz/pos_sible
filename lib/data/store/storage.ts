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
