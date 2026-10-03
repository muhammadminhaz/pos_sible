import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "@/lib/data/store/storage";

/** Where one card sits on the 12-column grid: column, row, and size in grid cells. */
export type Place = { i: string; x: number; y: number; w: number; h: number };

type State = {
  /** Saved arrangement per analytics section; a section with no entry uses its default layout. */
  layouts: Record<string, Place[]>;
  save: (section: string, layout: Place[]) => void;
  reset: (section?: string) => void;
};

export const useLayouts = create<State>()(
  persist(
    (set) => ({
      layouts: {},
      save: (section, layout) => set((s) => ({ layouts: { ...s.layouts, [section]: layout } })),
      reset: (section) => set((s) => ({ layouts: section ? Object.fromEntries(Object.entries(s.layouts).filter(([k]) => k !== section)) : {} })),
    }),
    { name: "posible:v1:analytics-layout", storage: safeStorage() },
  ),
);
