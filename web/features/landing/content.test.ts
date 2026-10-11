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

  it("lists the modules the server seeds, in order", () => {
    const schema = readFileSync(resolve(__dirname, "../../../api/lib/server/schema.ts"), "utf8");
    const seed = schema.slice(schema.indexOf("INSERT INTO modules"), schema.indexOf("ON CONFLICT", schema.indexOf("INSERT INTO modules")));
    const rows = [...seed.matchAll(/\('(\w+)', '([^']+)', \d+\)/g)].map((m) => ({ id: m[1], label: m[2] }));
    expect(content.sections.find((s) => s.id === "pricing")!.modules).toEqual(rows);
  });

  it("gives each plan known modules, and every higher plan everything the one below has", () => {
    const pricing = content.sections.find((s) => s.id === "pricing")!;
    const known = pricing.modules!.map((m) => m.id);
    pricing.plans!.forEach((plan, i) => {
      for (const m of plan.modules) expect(known).toContain(m);
      if (i > 0) expect(plan.modules).toEqual(expect.arrayContaining(pricing.plans![i - 1].modules));
    });
  });
});
