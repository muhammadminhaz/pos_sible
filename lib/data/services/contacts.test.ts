import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/data/errors";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { contactsService } from "./contacts";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

describe("contactsService.createCustomer", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("creates an active customer with the next contact code", async () => {
    const before = getDB().contacts.length;
    const maxCode = Math.max(...getDB().contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0));
    const c = await contactsService.createCustomer({ name: "  Rahim Uddin ", mobile: "01711000000", address: "Mirpur 10" });
    expect(c).toMatchObject({ type: "customer", name: "Rahim Uddin", mobile: "01711000000", active: true, points: 0 });
    expect(c.code).toBe(`CO${String(maxCode + 1).padStart(4, "0")}`);
    expect(c.address.line1).toBe("Mirpur 10");
    expect(getDB().contacts).toHaveLength(before + 1);
  });

  it("requires name and mobile", async () => {
    await expect(contactsService.createCustomer({ name: " ", mobile: "" })).rejects.toBeInstanceOf(ValidationError);
  });
});
