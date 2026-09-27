"use client";

import { useEffect, type ReactNode } from "react";
import { hydrateDB, useDB } from "./db";

/** Blocks children until the persisted DB is loaded (or seeded on first visit). */
export function DataGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useDB((s) => s.hydrated);
  useEffect(() => {
    if (!useDB.getState().hydrated) void hydrateDB();
  }, []);
  return hydrated ? children : fallback;
}
