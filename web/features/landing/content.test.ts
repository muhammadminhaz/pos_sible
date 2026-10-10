import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import content from "./content.json";

describe("landing content", () => {
  it("has no em dashes and no third-party branding", () => {
    const text = JSON.stringify(content);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/framer|qarin/i);
  });

  it("gives every section an id and a title", () => {
    for (const s of content.sections) expect(s.id && s.title).toBeTruthy();
  });

  it("shows the plans the server seeds", () => {
    const schema = readFileSync(resolve(__dirname, "../../../api/lib/server/schema.ts"), "utf8");
    const rows = [...schema.matchAll(/\('(\w+)', '\w+', (\d+|NULL), (\d+), \d\)/g)].map((m) => ({
      id: m[1],
      users: m[2] === "NULL" ? null : Number(m[2]),
      price: Number(m[3]),
    }));
    const plans = content.sections.find((s) => s.id === "pricing")!.plans!;
    expect(plans.map(({ id, users, price }) => ({ id, users, price }))).toEqual(rows);
  });
});
