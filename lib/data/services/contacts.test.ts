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

import { useSession } from "@/lib/auth/session";
import { paymentSummary } from "@/lib/domain/payments";
import type { ContactInput } from "./contacts";

const form = (over: Partial<ContactInput> = {}): ContactInput => ({
  type: "customer", kind: "individual", businessName: "", prefix: "", name: "New Person", mobile: "01999000111", altNumber: "", landline: "", email: "",
  dob: null, taxNumber: "", customerGroupId: null, payTerm: null, creditLimit: null, openingBalance: 0, assignedTo: [], crmSource: null,
  crmLifeStage: null, address: { line1: "", line2: "", city: "", state: "", country: "Bangladesh", zip: "" }, shippingAddress: "", customFields: [], active: true, ...over,
});

describe("contactsService write rules", () => {
  beforeEach(() => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
  });

  it("creates with the next code and edits in place", async () => {
    const { id } = await contactsService.save(form());
    expect((await contactsService.get(id)).code).toMatch(/^CO\d{4}$/);
    await contactsService.save({ ...form({ name: "Renamed" }), id });
    expect((await contactsService.get(id)).name).toBe("Renamed");
  });

  it("rejects a duplicate mobile, but not the contact's own", async () => {
    const taken = getDB().contacts.find((c) => !c.isDefault)!;
    await expect(contactsService.save(form({ mobile: taken.mobile }))).rejects.toMatchObject({ fields: { mobile: "duplicate" } });
    await expect(contactsService.save({ ...form({ name: taken.name, mobile: taken.mobile }), id: taken.id })).resolves.toBeTruthy();
  });

  it("needs the supplier permission to write a supplier", async () => {
    useSession.setState({ userId: "user_cashier" });
    await expect(contactsService.save(form({ type: "supplier" }))).rejects.toMatchObject({ code: "forbidden" });
  });

  it("won't delete the walk-in customer or a contact with transactions, but deletes an unused one", async () => {
    const walkIn = getDB().contacts.find((c) => c.isDefault)!;
    await expect(contactsService.remove([walkIn.id])).rejects.toMatchObject({ code: "default_contact" });
    const used = getDB().contacts.find((c) => !c.isDefault && getDB().transactions.some((t) => t.contactId === c.id))!;
    await expect(contactsService.remove([used.id])).rejects.toMatchObject({ code: "contact_in_use" });
    const { id } = await contactsService.save(form());
    await contactsService.remove([id]);
    expect(getDB().contacts.some((c) => c.id === id)).toBe(false);
  });

  it("filters customers by months since the last sale", async () => {
    const { id } = await contactsService.save(form());
    const out = await contactsService.list({ noSellMonths: 3, pageSize: -1, type: "customer" });
    expect(out.rows.map((r) => r.id)).toContain(id);
    expect(out.rows.every((r) => !r.lastSellDate || r.lastSellDate.slice(0, 10) < "2026-12-31")).toBe(true);
  });

  it("the ledger's final balance equals the contact's due", async () => {
    const c = (await contactsService.list({ hasDue: true, pageSize: -1 })).rows.find((r) => !r.isDefault)!;
    const ledger = await contactsService.ledger(c.id);
    expect(ledger.at(-1)!.balance).toBeCloseTo(c.due, 2);
    expect(ledger.map((e) => e.date)).toEqual([...ledger.map((e) => e.date)].sort());
  });

  it("payDue settles the oldest invoice first and never overpays", async () => {
    const row = (await contactsService.list({ sellDue: true, pageSize: -1 })).rows.find((r) => !r.isDefault && r.openingBalance <= 0)!;
    const open = getDB().transactions
      .filter((t) => t.contactId === row.id && t.type === "sell" && t.status === "final" && paymentSummary(t.totals.total, t.payments).due > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const first = open[0];
    const firstDue = paymentSummary(first.totals.total, first.payments).due;
    await contactsService.payDue(row.id, { amount: firstDue, method: "cash" });
    const after = getDB().transactions.find((t) => t.id === first.id)!;
    expect(paymentSummary(after.totals.total, after.payments).due).toBe(0);
    expect(after.paymentStatus).toBe("paid");
    const rest = open.slice(1).map((t) => getDB().transactions.find((x) => x.id === t.id)!);
    for (const t of rest) expect(paymentSummary(t.totals.total, t.payments).due).toBe(paymentSummary(open.find((o) => o.id === t.id)!.totals.total, open.find((o) => o.id === t.id)!.payments).due);
    const owed = (await contactsService.get(row.id)).sellDue;
    await expect(contactsService.payDue(row.id, { amount: owed + 1, method: "cash" })).rejects.toMatchObject({ fields: { amount: "invalid" } });
    await expect(contactsService.payDue(row.id, { amount: 0, method: "cash" })).rejects.toMatchObject({ fields: { amount: "invalid" } });
  });

  it("payDue spills over into the opening balance after invoices", async () => {
    const { id } = await contactsService.save(form({ openingBalance: 500 }));
    await contactsService.payDue(id, { amount: 200, method: "cash" });
    expect((await contactsService.get(id)).openingBalance).toBe(300);
    await expect(contactsService.payDue(id, { amount: 301, method: "cash" })).rejects.toMatchObject({ fields: { amount: "invalid" } });
  });

  it("payDue on a supplier writes a debit to the account ledger", async () => {
    const row = (await contactsService.list({ purchaseDue: true, pageSize: -1 })).rows[0];
    const n = getDB().accountTxns.length;
    await contactsService.payDue(row.id, { amount: 1, method: "cash" });
    const added = getDB().accountTxns.slice(n);
    if (added.length) expect(added[0].kind).toBe("debit");
    expect((await contactsService.get(row.id)).purchaseDue).toBeCloseTo(row.purchaseDue - 1, 2);
  });
});
