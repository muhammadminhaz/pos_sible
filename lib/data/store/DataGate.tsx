"use client";

import { useEffect, type ReactNode } from "react";
import { API_MODE } from "@/lib/data/api/mode";
import { hydrateDB, useDB } from "./db";

/** Blocks children until the persisted DB is loaded (or seeded on first visit). */
export function DataGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useDB((s) => s.hydrated) || API_MODE; // the server holds the data in API mode
  useEffect(() => {
    if (!API_MODE && !useDB.getState().hydrated) void hydrateDB();
  }, []);
  return hydrated ? children : fallback;
}
