"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@/lib/data/schemas";
import { backupsService } from "@/lib/data/services/admin";
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

export function useBackups() {
  return useQuery({ queryKey: keys.backups, queryFn: backupsService.list });
}

/** Restoring replaces the whole database, so every cached query is dropped. */
export function useBackupActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.backups });
  const reload = () => qc.invalidateQueries();
  return {
    create: useMutation({ mutationFn: (name?: string) => backupsService.create(name), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => backupsService.remove(id), onSuccess: refresh }),
    restoreFile: useMutation({ mutationFn: (json: string) => backupsService.restore(json), onSuccess: reload }),
    restoreSaved: useMutation({ mutationFn: (id: string) => backupsService.restoreFrom(id), onSuccess: reload }),
  };
}
