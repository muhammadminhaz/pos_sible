"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/lib/data/services/notifications";
import { keys } from "./keys";

/** Pay terms pass and lots expire with nobody touching anything, so the bell re-asks (and the server re-derives) on a timer. */
const RECHECK_MS = 5 * 60 * 1000;

export function useNotifications() {
  return useQuery({ queryKey: keys.table("notifications").all, queryFn: async () => {
      await notificationsService.sync(); // re-derive from the data first, so the bell is true right now
      return notificationsService.recent();
    }, refetchInterval: RECHECK_MS, refetchOnWindowFocus: true });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: keys.table("notifications").all });
  return {
    markAllRead: useMutation({ mutationFn: notificationsService.markAllRead, onSuccess }),
    markRead: useMutation({ mutationFn: notificationsService.markRead, onSuccess }),
  };
}
