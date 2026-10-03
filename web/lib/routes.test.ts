import { describe, expect, it } from "vitest";
import { NAV } from "./nav";
import { ROUTES } from "./routes";

describe("ROUTES", () => {
  it("has a scaffolded route for every nav link", () => {
    const own = new Set(["/home", "/pos"]);
    const hrefs = NAV.flatMap((g) => (g.items ? g.items.map((i) => i.href) : [g.href!])).map((h) => h.split("?")[0]);
    expect(hrefs.filter((h) => !own.has(h) && !(h in ROUTES))).toEqual([]);
  });
});
