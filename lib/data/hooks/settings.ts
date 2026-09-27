"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@/lib/data/schemas";
import { settingsService } from "@/lib/data/services/settings";
import { keys } from "./keys";

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: settingsService.get, staleTime: Infinity });
}

export function useUpdateSettings<K extends keyof Settings>(section: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings[K]>) => settingsService.update(section, patch),
    onSuccess: (s) => qc.setQueryData(keys.settings, s),
  });
}
