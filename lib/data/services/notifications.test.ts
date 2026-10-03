import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO, SEED_USER } from "@/lib/data/seed/mk";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { notificationsService, syncNotifications } from "./notifications";

const TODAY = "2026-09-28";

function addAlert(over: Record<string, unknown>) {
  commit((d) => {
    d.notifications.push({
      id: `n_${d.notifications.length}`, createdAt: `${TODAY}T09:00:00`, createdBy: null, title: "", body: "", readAt: null, kind: "warning", href: "/x",
      key: "k", type: "lowStock", params: {}, locationId: null, permission: null, signal: 1, readBy: {}, ...over,
    } as never);
  });
}

beforeEach(() => {
  resetDB(structuredClone(createSeed({ seed: 42, today: TODAY })));
  commit((d) => {
    d.notifications = [];
    d.roles.push({ id: "role_clerk", createdAt: "", createdBy: null, name: "Clerk", permissions: ["pos.access", "report.stock"], isServiceStaff: false, locationIds: [] });
    d.users.push({ id: "user_clerk", createdAt: "", createdBy: null, username: "clerk", password: "x", prefix: "", firstName: "Clerk", lastName: "", email: "", roleId: "role_clerk", locationIds: [LOC_RANGO], language: "en", isActive: true, allowLogin: true, isSalesAgent: false, commissionPercent: 0, maxSalesDiscountPercent: null, avatar: null, profile: {} } as never);
  });
  useSession.setState({ userId: SEED_USER });
});

describe("notificationsService", () => {
  it("shows a person only the alerts for their permissions and locations", async () => {
    addAlert({ id: "a_sales", key: "a", permission: "sell.view", locationId: LOC_RANGO });
    addAlert({ id: "a_stock_rango", key: "b", permission: "report.stock", locationId: LOC_RANGO });
    addAlert({ id: "a_stock_nipun", key: "c", permission: "report.stock", locationId: LOC_NIPUN });
    const admin = await notificationsService.recent();
    expect(admin.items.map((n) => n.id).sort()).toEqual(["a_sales", "a_stock_nipun", "a_stock_rango"]);
    useSession.setState({ userId: "user_clerk" });
    const clerk = await notificationsService.recent();
    expect(clerk.items.map((n) => n.id)).toEqual(["a_stock_rango"]);
    expect(clerk.unread).toBe(1);
  });

  it("tracks read state per person", async () => {
    addAlert({ id: "a1", key: "a", permission: "report.stock", locationId: LOC_RANGO });
    await notificationsService.markRead("a1");
    expect((await notificationsService.recent()).unread).toBe(0);
    useSession.setState({ userId: "user_clerk" });
    expect((await notificationsService.recent()).unread).toBe(1);
    await notificationsService.markAllRead();
    expect((await notificationsService.recent()).unread).toBe(0);
    useSession.setState({ userId: SEED_USER });
    expect((await notificationsService.recent()).unread).toBe(0);
  });

  it("lists unread, then worse news first", async () => {
    addAlert({ id: "warn", key: "w", kind: "warning", createdAt: `${TODAY}T10:00:00` });
    addAlert({ id: "bad", key: "d", kind: "danger", createdAt: `${TODAY}T08:00:00` });
    addAlert({ id: "read", key: "r", kind: "danger", readAt: `${TODAY}T11:00:00` });
    expect((await notificationsService.recent()).items.map((n) => n.id)).toEqual(["bad", "warn", "read"]);
  });
});

describe("syncNotifications", () => {
  it("writes the alerts that are true, then reports no change the second time", () => {
    commit((d) => {
      for (const p of d.products) p.alertQty = 1_000_000;
    });
    expect(syncNotifications(`${TODAY}T09:00:00`)).toBe(true);
    const keyed = getDB().notifications.filter((n) => n.key);
    expect(keyed.length).toBeGreaterThan(0);
    expect(keyed.every((n) => n.type && n.permission)).toBe(true);
    expect(syncNotifications(`${TODAY}T09:01:00`)).toBe(false);
  });
});
