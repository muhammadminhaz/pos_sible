import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { activeUserId } from "@/lib/auth/session";
import type { DB, Onboarding, Settings } from "@/lib/data/schemas";
import { createEmptySeed } from "@/lib/data/seed/empty";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { todayISO } from "@/lib/dates";
import { delay, nowISO } from "./_util";

export type OnboardingInput = {
  mode: "demo" | "fresh";
  businessName: string;
  currencySymbol: string;
  currencyCode: string;
  locationName: string;
  phone: string;
  city: string;
  themeColor: Settings["system"]["themeColor"];
};

export type ChecklistStep = "product" | "customer" | "sale" | "expense" | "reports";
export const CHECKLIST_STEPS: ChecklistStep[] = ["product", "customer", "sale", "expense", "reports"];

/** Each step is ticked by something the owner did after setup, so a demo shop still starts with a clean list. */
export function checklistStatus(db: DB): Record<ChecklistStep, boolean> {
  const since = db.meta.onboarding?.completedAt ?? "9999";
  const after = (createdAt: string) => createdAt >= since;
  return {
    product: db.products.some((p) => after(p.createdAt)),
    customer: db.contacts.some((c) => !c.isDefault && c.type !== "supplier" && after(c.createdAt)),
    sale: db.transactions.some((t) => t.type === "sell" && t.status === "final" && after(t.createdAt)),
    expense: db.transactions.some((t) => t.type === "expense" && after(t.createdAt)),
    reports: !!db.meta.onboarding?.visited?.includes("reports"),
  };
}

export const onboardingService = service("onboardingService", {
  /** Applies the wizard: optionally swaps in an empty shop, then the business profile. One step, all or nothing. */
  async complete(input: OnboardingInput): Promise<void> {
    await delay();
    assertCan("settings.business");
    const name = input.businessName.trim();
    if (!name) throw new Error("business name required");
    const current = getDB();
    const base = input.mode === "fresh" ? createEmptySeed({ today: todayISO() }) : structuredClone(current);
    if (input.mode === "fresh") {
      // Whoever is signed in keeps their account, password and role; the sample staff and roles come from the empty seed.
      const keep = new Set([activeUserId()].filter(Boolean));
      const mine = current.users.filter((u) => keep.has(u.id) || u.id === "user_admin");
      base.roles = current.roles;
      base.users = mine.map((u) => ({ ...u, locationIds: u.locationIds.filter((l) => base.locations.some((x) => x.id === l)) }));
    }
    const apply = (d: DB) => {
      d.settings.business.name = name;
      d.settings.business.currencySymbol = input.currencySymbol.trim() || d.settings.business.currencySymbol;
      d.settings.business.currencyCode = input.currencyCode.trim() || d.settings.business.currencyCode;
      d.settings.system.themeColor = input.themeColor;
      const loc = d.locations[0];
      if (loc) {
        if (input.locationName.trim()) loc.name = input.locationName.trim();
        loc.mobile = input.phone.trim() || loc.mobile;
        loc.address = { ...loc.address, city: input.city.trim() || loc.address.city };
      }
      d.meta.onboarding = { done: true, mode: input.mode, completedAt: nowISO(), checklistDismissed: false, visited: [] };
    };
    if (input.mode === "fresh") {
      apply(base);
      resetDB(base);
    } else commit(apply);
  },

  /** Skip: keep the demo shop exactly as it is. */
  async skip(): Promise<void> {
    await delay();
    commit((d) => void (d.meta.onboarding = { done: true, mode: "demo", completedAt: nowISO(), checklistDismissed: false, visited: [] }));
  },

  async patch(patch: Partial<Onboarding>): Promise<void> {
    commit((d) => void (d.meta.onboarding = { done: true, ...d.meta.onboarding, ...patch }));
  },

  async visit(step: string): Promise<void> {
    const seen = getDB().meta.onboarding?.visited ?? [];
    if (seen.includes(step)) return;
    commit((d) => void (d.meta.onboarding = { done: true, ...d.meta.onboarding, visited: [...seen, step] }));
  },

  /** Run the wizard again (Settings → Business), e.g. after a demo to start over with a fresh shop. */
  async restart(): Promise<void> {
    commit((d) => void (d.meta.onboarding = { done: false }));
  },
});
