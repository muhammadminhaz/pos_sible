import { hasPermission } from "@/lib/auth/permissions";
import { currentUser } from "@/lib/auth/session";
import { service } from "@/lib/data/api/facade";
import type { Notification } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { computeAlerts, reconcile } from "@/lib/domain/alerts";
import { delay, nowISO, uid } from "./_util";

const SEVERITY = { danger: 3, warning: 2, info: 1, success: 0 } as const;

type Viewer = NonNullable<ReturnType<typeof currentUser>>;

/** Alerts are shared records; each person only sees the ones they have the permission and location access for. */
function visibleTo(me: Viewer | null, n: Notification): boolean {
  if (!me) return !n.permission;
  if (!hasPermission(me.role, n.permission ?? undefined)) return false;
  if (!n.locationId) return true;
  const allowed = (ids: string[]) => ids.length === 0 || ids.includes(n.locationId!);
  return allowed(me.user.locationIds) && allowed(me.role.locationIds);
}

const readAtFor = (me: Viewer | null, n: Notification): string | null => (me && n.readBy?.[me.user.id]) || n.readAt || null;

/** Recalculates the alerts from the current data and stores the difference. Returns whether anything changed. */
export function syncNotifications(now: string = nowISO()): boolean {
  const db = getDB();
  const next = reconcile(db.notifications, computeAlerts(db, todayISO(db.settings.business.timeZone)), now, () => uid("n"));
  if (!next) return false;
  commit((d) => {
    d.notifications = next;
  });
  return true;
}

export const notificationsService = service("notificationsService", {
  async recent(limit = 20): Promise<{ items: Notification[]; unread: number }> {
    await delay();
    const me = currentUser();
    const mine = getDB()
      .notifications.filter((n) => visibleTo(me, n))
      .map((n) => ({ ...n, readAt: readAtFor(me, n) }));
    // Unread first, then the worse news, then the newer.
    mine.sort((a, b) => Number(!!a.readAt) - Number(!!b.readAt) || SEVERITY[b.kind] - SEVERITY[a.kind] || b.createdAt.localeCompare(a.createdAt));
    return { items: mine.slice(0, limit), unread: mine.filter((n) => !n.readAt).length };
  },
  async markAllRead(): Promise<void> {
    await delay();
    const me = currentUser();
    const at = nowISO();
    commit((db) => {
      for (const n of db.notifications) {
        if (!visibleTo(me, n)) continue;
        if (me) n.readBy = { ...(n.readBy ?? {}), [me.user.id]: n.readBy?.[me.user.id] ?? at };
        else n.readAt ??= at;
      }
    });
  },
  async markRead(id: string): Promise<void> {
    await delay();
    const me = currentUser();
    commit((db) => {
      const n = db.notifications.find((x) => x.id === id);
      if (!n) return;
      if (me) n.readBy = { ...(n.readBy ?? {}), [me.user.id]: n.readBy?.[me.user.id] ?? nowISO() };
      else n.readAt ??= nowISO();
    });
  },
  /** Recalculates the alerts from the data; runs next to the data, so in API mode that is the server. */
  async sync(): Promise<boolean> {
    await delay();
    return syncNotifications();
  },
});
