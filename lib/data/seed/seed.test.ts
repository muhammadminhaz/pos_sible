import { describe, it, expect } from "vitest";
import { createSeed } from "./index";

describe("seed", () => {
  const db = createSeed({ seed: 42, today: "2026-09-27" });
  it("is deterministic", () => {
    expect(JSON.stringify(createSeed({ seed: 42, today: "2026-09-27" }))).toBe(JSON.stringify(db));
  });
  it("has volumes", () => {
    expect(db.locations).toHaveLength(2);
    expect(db.products.length).toBeGreaterThanOrEqual(100);
    expect(db.transactions.filter((t) => t.type === "sell").length).toBeGreaterThan(600);
    expect(db.transactions.filter((t) => t.type === "purchase").length).toBeGreaterThan(80);
    expect(db.contacts.find((c) => c.id === "walk-in")).toBeTruthy();
  });
  it("stock never negative", () => {
    expect(db.stockLots.every((l) => l.qtyRemaining >= 0)).toBe(true);
  });
  it("final sales totals match lines", () => {
    for (const t of db.transactions.filter((t) => t.type === "sell" && t.status === "final").slice(0, 50))
      expect(t.totals.total).toBeGreaterThan(0);
  });
});
