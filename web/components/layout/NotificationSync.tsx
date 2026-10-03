"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/data/hooks/keys";
import { notificationsService } from "@/lib/data/services/notifications";
import { useDB } from "@/lib/data/store/db";

const RECHECK_MS = 10 * 60 * 1000;

/**
 * Keeps the bell honest: re-derives the alerts shortly after any data change, when the tab regains focus,
 * and every few minutes (a pay term can pass or a lot can expire with nobody touching anything).
 * Renders nothing.
 */
export function NotificationSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      notificationsService
        .sync()
        .then((changed) => {
          if (changed) qc.invalidateQueries({ queryKey: keys.table("notifications").all });
        })
        .catch(() => {});
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 600);
    };
    soon();
    // Writing the alerts changes the store too; reconcile returns "no change" the second time, so this settles.
    const unsubscribe = useDB.subscribe((s, prev) => {
      if (s.db !== prev.db) soon();
    });
    const interval = setInterval(run, RECHECK_MS);
    window.addEventListener("focus", run);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("focus", run);
    };
  }, [qc]);

  return null;
}
