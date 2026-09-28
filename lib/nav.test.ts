import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { findNavTrail, NAV } from "./nav";

describe("findNavTrail", () => {
  it("matches top-level links", () => {
    expect(findNavTrail("/home").group?.key).toBe("home");
  });

  it("prefers the most specific item", () => {
    expect(findNavTrail("/products").item?.key).toBe("listProducts");
    expect(findNavTrail("/products/new").item?.key).toBe("addProduct");
    expect(findNavTrail("/products/p_0001/edit").item?.key).toBe("listProducts");
  });

  it("uses the query string to pick query-specific items", () => {
    expect(findNavTrail("/sales").item?.key).toBe("allSales");
    expect(findNavTrail("/sales", "?channel=pos").item?.key).toBe("listPos");
    expect(findNavTrail("/sales/new", "?status=draft").item?.key).toBe("addDraft");
  });

  it("returns nothing for unknown routes", () => {
    expect(findNavTrail("/nope")).toEqual({ group: undefined, item: undefined });
  });

  it("has unique item keys", () => {
    const keys = NAV.flatMap((g) => [g.key, ...(g.items ?? []).map((i) => i.key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("NAV labels", () => {
  it("has a translation for every group and item", () => {
    const labels = en.nav as Record<string, string>;
    for (const g of NAV) for (const k of [g.key, ...(g.items ?? []).map((i) => i.key)]) expect(labels[k], k).toBeTruthy();
  });
});
