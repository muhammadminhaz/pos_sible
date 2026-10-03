import { service } from "@/lib/data/api/facade";
import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { contact, importBatch } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { parseCSV } from "@/lib/csv";
import { delay, nowISO, uid } from "./_util";
import type { Contact } from "@/lib/data/schemas";

export const CONTACT_IMPORT_COLUMNS = ["type", "name", "business_name", "mobile", "email", "tax_number", "opening_balance", "credit_limit", "pay_term_number", "pay_term_type", "address", "city", "customer_group"] as const;
export type ContactImportRow = { row: number; data: Omit<Contact, "id" | "createdAt" | "createdBy" | "code"> };
export type ContactParse = { rows: ContactImportRow[]; errors: { row: number; message: string }[] };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const num = (s: string): number | null => (s.trim() === "" ? null : /^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : Number.NaN);

export const contactImportService = service("contactImportService", {
  async parse(csv: string): Promise<ContactParse> {
    await delay();
    assertCan("contacts.import");
    const d = getDB();
    const [head, ...body] = parseCSV(csv);
    if (!head || !["type", "name", "mobile"].every((c) => head.includes(c))) return { rows: [], errors: [{ row: 1, message: "missing_columns" }] };
    const errors: ContactParse["errors"] = [];
    const rows: ContactImportRow[] = [];
    const taken = new Set(d.contacts.map((c) => c.mobile.trim()));
    const seen = new Set<string>();
    body.forEach((r, i) => {
      const row = i + 2;
      const bad = (message: string) => void errors.push({ row, message });
      const c = (n: string) => (r[head.indexOf(n)] ?? "").trim();
      const type = c("type").toLowerCase();
      if (!["customer", "supplier", "both"].includes(type)) return bad("type");
      if (!c("name")) return bad("name");
      const mobile = c("mobile");
      if (!mobile) return bad("mobile");
      if (taken.has(mobile)) return bad("mobile_exists");
      if (seen.has(mobile)) return bad("duplicate_mobile");
      seen.add(mobile);
      const opening = num(c("opening_balance"));
      const credit = num(c("credit_limit"));
      const term = num(c("pay_term_number"));
      if ([opening, credit, term].some((n) => Number.isNaN(n)) || (credit != null && credit < 0) || (term != null && term < 0)) return bad("number");
      const termType = (c("pay_term_type") || "days").toLowerCase();
      if (term != null && termType !== "days" && termType !== "months") return bad("pay_term_type");
      const group = c("customer_group") ? d.customerGroups.find((g) => same(g.name, c("customer_group"))) : null;
      if (c("customer_group") && !group) return bad("customer_group");
      rows.push({
        row,
        data: contact.omit({ id: true, createdAt: true, createdBy: true, code: true }).parse({
          type, name: c("name"), businessName: c("business_name"), kind: c("business_name") ? "business" : "individual", mobile, email: c("email"), taxNumber: c("tax_number"),
          openingBalance: opening ?? 0, creditLimit: credit, payTerm: term != null ? { number: term, type: termType } : null,
          address: { line1: c("address"), city: c("city") }, customerGroupId: group?.id ?? null,
        }),
      });
    });
    return { rows, errors };
  },

  /** One commit, so a failure leaves contacts untouched. */
  async commit(rows: ContactImportRow[], fileName: string): Promise<{ created: number }> {
    await delay();
    assertCan("contacts.import");
    commit((d) => {
      let n = Math.max(0, ...d.contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0));
      const ids = rows.map((r) => {
        const id = uid("c");
        d.contacts.push(contact.parse({ ...r.data, id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, code: `${d.settings.prefixes.contacts}${String(++n).padStart(4, "0")}` }));
        return id;
      });
      d.importBatches.push(importBatch.parse({ id: uid("imp"), createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, kind: "contacts", fileName, rows: rows.length, recordIds: ids }));
    });
    return { created: rows.length };
  },
});
