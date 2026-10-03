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

type Recent = Awaited<ReturnType<typeof notificationsService.recent>>;

export function useNotificationMutations() {
  const qc = useQueryClient();
  const key = keys.table("notifications").all;
  const onSuccess = () => qc.invalidateQueries({ queryKey: key });
  /** The bell's count drops the moment something is seen, before the server answers. */
  const markLocally = (match: (id: string) => boolean) =>
    qc.setQueryData<Recent>(key, (d) => {
      if (!d) return d;
      const at = new Date().toISOString();
      const items = d.items.map((n) => (!n.readAt && match(n.id) ? { ...n, readAt: at } : n));
      return { items, unread: Math.max(0, d.unread - items.filter((n, i) => n.readAt && !d.items[i].readAt).length) };
    });
  return {
    markAllRead: useMutation({ mutationFn: notificationsService.markAllRead, onMutate: () => markLocally(() => true), onSuccess }),
    markRead: useMutation({ mutationFn: notificationsService.markRead, onMutate: (id: string) => markLocally((x) => x === id), onSuccess }),
  };
}
