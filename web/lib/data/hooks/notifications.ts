"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/lib/data/services/notifications";
import { keys } from "./keys";

export function useNotifications() {
  return useQuery({ queryKey: keys.table("notifications").all, queryFn: () => notificationsService.recent() });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: keys.table("notifications").all });
  return {
    markAllRead: useMutation({ mutationFn: notificationsService.markAllRead, onSuccess }),
    markRead: useMutation({ mutationFn: notificationsService.markRead, onSuccess }),
  };
}
