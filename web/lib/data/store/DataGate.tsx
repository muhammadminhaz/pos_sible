"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { API_MODE, BUILD_API_MODE, DEMO } from "@/lib/data/api/mode";
import { DEMO_DB_KEY, hydrateDB, useDB } from "./db";
import { removeStoredDb } from "./storage";

const noop = () => () => {};

/** Blocks children until the persisted DB is loaded (or seeded on first visit). */
export function DataGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  // The server renders with the build's mode; a demo tab switches to local data right after hydration.
  const api = useSyncExternalStore(noop, () => API_MODE, () => BUILD_API_MODE);
  const hydrated = useDB((s) => s.hydrated) || api; // the server holds the data in API mode
  useEffect(() => {
    if (!API_MODE && !useDB.getState().hydrated) void hydrateDB();
    // A demo left behind by a closed tab is wiped on the next normal visit.
    if (!DEMO) void removeStoredDb(DEMO_DB_KEY);
  }, []);
  return hydrated ? children : fallback;
}
