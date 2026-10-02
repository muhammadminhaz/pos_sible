import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { discount, type Discount } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { delay, matches, nowISO, paginate, uid, type ListQuery, type ListResult } from "./_util";

export type DiscountFilters = ListQuery & { active?: boolean; locationId?: string };
export type DiscountInputData = Omit<Discount, "id" | "createdAt" | "createdBy"> & { id?: string };
export type DiscountRow = Discount & { locationName: string; scope: string };

export const discountsService = service("discountsService", {
  async list(f: DiscountFilters = {}): Promise<ListResult<DiscountRow>> {
    await delay();
    const d = getDB();
    const rows = d.discounts
      .filter((x) => f.active == null || x.active === f.active)
      .filter((x) => !f.locationId || x.locationId === f.locationId)
      .filter((x) => matches(f.search, x.name))
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
      .map((x): DiscountRow => ({
        ...x,
        locationName: d.locations.find((l) => l.id === x.locationId)?.name ?? "",
        scope: [
          x.brandId && d.brands.find((b) => b.id === x.brandId)?.name,
          x.categoryId && d.categories.find((c) => c.id === x.categoryId)?.name,
          ...x.productIds.map((id) => d.products.find((p) => p.id === id)?.name),
        ].filter(Boolean).join(", "),
      }));
    return paginate(rows, f);
  },

  async save(data: DiscountInputData): Promise<string> {
    await delay();
    assertCan("discount.manage");
    if (data.endsAt < data.startsAt) throw new ValidationError({ endsAt: "before_start" });
    if (data.type === "percentage" && data.amount > 100) throw new ValidationError({ amount: "max_100" });
    if (!data.productIds.length && !data.brandId && !data.categoryId) throw new ValidationError({ scope: "required" });
    let id = data.id ?? "";
    commit((d) => {
      if (data.id) {
        const i = d.discounts.findIndex((x) => x.id === data.id);
        if (i < 0) throw new NotFoundError("Discount");
        d.discounts[i] = discount.parse({ ...d.discounts[i], ...data });
      } else {
        id = uid("dis");
        d.discounts.push(discount.parse({ ...data, id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null }));
      }
    });
    return id;
  },

  async setActive(ids: string[], active: boolean): Promise<void> {
    await delay();
    assertCan("discount.manage");
    commit((d) => {
      for (const x of d.discounts) if (ids.includes(x.id)) x.active = active;
    });
  },

  async remove(ids: string[]): Promise<void> {
    await delay();
    assertCan("discount.manage");
    commit((d) => {
      d.discounts = d.discounts.filter((x) => !ids.includes(x.id));
    });
  },
});
