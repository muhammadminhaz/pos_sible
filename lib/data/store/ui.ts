import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "./storage";

export type Density = "comfortable" | "compact";
export type TablePref = { hidden: string[]; pageSize?: number };

type UIState = {
  sidebarCollapsed: boolean;
  openGroups: string[];
  density: Density;
  locationId: string | "all";
  tablePrefs: Record<string, TablePref>;
  setSidebarCollapsed: (v: boolean) => void;
  toggleGroup: (key: string) => void;
  setOpenGroups: (keys: string[]) => void;
  setDensity: (d: Density) => void;
  setLocationId: (id: string | "all") => void;
  setTablePref: (table: string, pref: Partial<TablePref>) => void;
};

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      openGroups: [],
      density: "comfortable",
      locationId: "all",
      tablePrefs: {},
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setOpenGroups: (openGroups) => set({ openGroups }),
      toggleGroup: (key) =>
        set((s) => ({ openGroups: s.openGroups.includes(key) ? s.openGroups.filter((k) => k !== key) : [...s.openGroups, key] })),
      setDensity: (density) => set({ density }),
      setLocationId: (locationId) => set({ locationId }),
      setTablePref: (table, pref) =>
        set((s) => ({ tablePrefs: { ...s.tablePrefs, [table]: { ...(s.tablePrefs[table] ?? { hidden: [] }), ...pref } } })),
    }),
    { name: "posible:v1:ui", storage: safeStorage() },
  ),
);
