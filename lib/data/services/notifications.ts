import type { Notification } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { delay, nowISO } from "./_util";

export const notificationsService = {
  async recent(limit = 20): Promise<{ items: Notification[]; unread: number }> {
    await delay();
    const all = [...getDB().notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: all.slice(0, limit), unread: all.filter((n) => !n.readAt).length };
  },
  async markAllRead(): Promise<void> {
    await delay();
    const at = nowISO();
    commit((db) => {
      for (const n of db.notifications) n.readAt ??= at;
    });
  },
  async markRead(id: string): Promise<void> {
    await delay();
    commit((db) => {
      const n = db.notifications.find((x) => x.id === id);
      if (n) n.readAt ??= nowISO();
    });
  },
};
