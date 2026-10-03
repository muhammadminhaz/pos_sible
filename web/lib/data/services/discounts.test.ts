import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { findDiscount } from "@/lib/domain/discounts";
import { discountsService, type DiscountInputData } from "./discounts";

const seed = createSeed({ seed: 42, today: "2026-09-28" });
const rule = (over: Partial<DiscountInputData> = {}): DiscountInputData => ({
  name: "Eid offer", locationId: null, productIds: [getDB().products[0].id], brandId: null, categoryId: null, priority: 5,
  type: "percentage", amount: 10, startsAt: "2026-09-01", endsAt: "2026-12-31", priceGroupIds: [], applyInCustomerGroups: false, active: true, ...over,
});

describe("discountsService", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("saves a rule that the domain resolver then applies", async () => {
    const id = await discountsService.save(rule());
    const r = getDB().discounts.find((x) => x.id === id)!;
    const hit = findDiscount(getDB().discounts, { productId: r.productIds[0], locationId: getDB().locations[0].id, at: "2026-10-01" });
    expect(hit?.id).toBe(id);
  });

  it("rejects an end date before the start, >100%, and an empty scope", async () => {
    await expect(discountsService.save(rule({ startsAt: "2026-10-02", endsAt: "2026-10-01" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(discountsService.save(rule({ amount: 101 }))).rejects.toBeInstanceOf(ValidationError);
    await expect(discountsService.save(rule({ productIds: [] }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("inactive and expired rules are not applied", async () => {
    const id = await discountsService.save(rule({ active: false }));
    const p = getDB().discounts.find((x) => x.id === id)!.productIds[0];
    const ctx = { productId: p, locationId: getDB().locations[0].id, at: "2026-10-01" };
    expect(findDiscount(getDB().discounts.filter((x) => x.id === id), ctx)).toBeNull();
    await discountsService.setActive([id], true);
    expect(findDiscount(getDB().discounts.filter((x) => x.id === id), ctx)?.id).toBe(id);
    expect(findDiscount(getDB().discounts.filter((x) => x.id === id), { ...ctx, at: "2027-01-02" })).toBeNull();
  });

  it("bulk setActive and the active filter", async () => {
    const all = (await discountsService.list({ pageSize: -1 })).rows;
    await discountsService.setActive(all.map((x) => x.id), false);
    expect((await discountsService.list({ active: true, pageSize: -1 })).total).toBe(0);
    expect((await discountsService.list({ active: false, pageSize: -1 })).total).toBe(all.length);
  });

  it("update keeps the id; remove deletes", async () => {
    const id = await discountsService.save(rule());
    await discountsService.save({ ...rule({ name: "Renamed" }), id });
    expect(getDB().discounts.find((x) => x.id === id)!.name).toBe("Renamed");
    await discountsService.remove([id]);
    expect(getDB().discounts.some((x) => x.id === id)).toBe(false);
  });

  it("writes need discount.manage", async () => {
    useSession.setState({ userId: "user_manager" });
    await expect(discountsService.save(rule())).rejects.toMatchObject({ code: "forbidden" });
  });
});
