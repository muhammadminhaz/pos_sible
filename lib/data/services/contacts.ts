import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { contact, type Contact, type DB } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { paymentSummary } from "@/lib/domain/payments";
import { delay, matches, nowISO, paginate, uid, type ListQuery, type ListResult } from "./_util";

export type ContactRow = Contact & {
  groupName?: string;
  /** Sells for customers, purchases for suppliers (both for "both"). */
  totalInvoice: number;
  totalPaid: number;
  due: number;
  returnDue: number;
};

export type ContactFilters = ListQuery & {
  type?: "supplier" | "customer";
  customerGroupId?: string;
  assignedTo?: string;
  active?: "active" | "inactive";
  hasDue?: boolean;
};

function toRows(db: DB): ContactRow[] {
  const group = new Map(db.customerGroups.map((g) => [g.id, g.name]));
  const agg = new Map<string, { invoice: number; paid: number; returnDue: number }>();
  for (const t of db.transactions) {
    if (!t.contactId) continue;
    const isInvoice = (t.type === "sell" && t.status === "final") || (t.type === "purchase" && t.status === "received");
    const isReturn = t.type === "sell_return" || t.type === "purchase_return";
    if (!isInvoice && !isReturn) continue;
    const a = agg.get(t.contactId) ?? { invoice: 0, paid: 0, returnDue: 0 };
    const s = paymentSummary(t.totals.total, t.payments);
    if (isInvoice) {
      a.invoice += t.totals.total;
      a.paid += Math.min(s.paid, t.totals.total);
    } else {
      a.returnDue += s.due;
    }
    agg.set(t.contactId, a);
  }
  return db.contacts.map((c) => {
    const a = agg.get(c.id) ?? { invoice: 0, paid: 0, returnDue: 0 };
    return {
      ...c,
      groupName: c.customerGroupId ? group.get(c.customerGroupId) : undefined,
      totalInvoice: roundMoney(a.invoice),
      totalPaid: roundMoney(a.paid),
      due: roundMoney(a.invoice - a.paid + c.openingBalance - a.returnDue),
      returnDue: roundMoney(a.returnDue),
    };
  });
}

export type NewCustomer = { name: string; mobile: string; customerGroupId?: string | null; address?: string };

export const contactsService = {
  async list(f: ContactFilters = {}): Promise<ListResult<ContactRow>> {
    await delay();
    const rows = toRows(getDB()).filter(
      (c) =>
        (!f.type || c.type === f.type || c.type === "both") &&
        (!f.customerGroupId || c.customerGroupId === f.customerGroupId) &&
        (!f.assignedTo || c.assignedTo.includes(f.assignedTo)) &&
        (!f.active || c.active === (f.active === "active")) &&
        (!f.hasDue || c.due > 0) &&
        matches(f.search, c.name, c.businessName, c.mobile, c.code, c.email, c.taxNumber),
    );
    return paginate(f.sort ? rows : rows.filter((c) => c.isDefault).concat(rows.filter((c) => !c.isDefault)), f);
  },

  async get(id: string): Promise<ContactRow> {
    await delay();
    const row = toRows(getDB()).find((c) => c.id === id);
    if (!row) throw new NotFoundError("Contact");
    return row;
  },

  async setActive(ids: string[], active: boolean): Promise<void> {
    await delay();
    commit((d) => {
      for (const c of d.contacts) if (ids.includes(c.id) && !c.isDefault) c.active = active;
    });
  },

  async createCustomer(input: NewCustomer): Promise<Contact> {
    await delay();
    const name = input.name.trim();
    const mobile = input.mobile.trim();
    const fields: Record<string, string> = {};
    if (!name) fields.name = "required";
    if (!mobile) fields.mobile = "required";
    if (Object.keys(fields).length) throw new ValidationError(fields);
    let created!: Contact;
    commit((d) => {
      const n = Math.max(0, ...d.contacts.map((c) => Number(c.code.replace(/\D/g, "")) || 0)) + 1;
      created = contact.parse({
        id: uid("c"),
        createdAt: nowISO(),
        createdBy: currentUser()?.user.id ?? null,
        code: `${d.settings.prefixes.contacts}${String(n).padStart(4, "0")}`,
        type: "customer",
        name,
        mobile,
        customerGroupId: input.customerGroupId ?? null,
        address: { line1: input.address?.trim() ?? "" },
      });
      d.contacts.push(created);
    });
    return created;
  },
};
