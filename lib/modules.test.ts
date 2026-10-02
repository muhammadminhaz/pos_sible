import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { isPathEnabled, moduleForPath } from "./modules";

describe("modules", () => {
  const base = createSeed({ seed: 1, today: "2026-09-28" }).settings;
  const m = { modules: { ...base.modules, purchases: false, addSale: false }, sale: { ...base.sale, enableSalesOrder: false } };
  it("maps routes to their switch", () => {
    expect(moduleForPath("/purchases/12/edit")).toBe("purchases");
    expect(moduleForPath("/sales/new?status=draft")).toBe("addSale");
    expect(moduleForPath("/sales")).toBeNull();
  });
  it("hides disabled modules and leaves the rest", () => {
    expect(isPathEnabled(m, "/purchases")).toBe(false);
    expect(isPathEnabled(m, "/sales/new")).toBe(false);
    expect(isPathEnabled(m, "/sales")).toBe(true);
    expect(isPathEnabled(m, "/expenses")).toBe(true);
    expect(isPathEnabled(m, "/sales/orders")).toBe(false);
    expect(isPathEnabled({ ...m, sale: { ...m.sale, enableSalesOrder: true } }, "/sales/orders")).toBe(true);
  });
});
