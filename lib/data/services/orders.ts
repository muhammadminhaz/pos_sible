import { assertCan } from "@/lib/auth/assertCan";
import { currentUser } from "@/lib/auth/session";
import { AppError, NotFoundError, ValidationError } from "@/lib/data/errors";
import { transaction, type ShippingStatus } from "@/lib/data/schemas";
import { commit, getDB } from "@/lib/data/store/db";
import { orderTotals } from "@/lib/domain/totals";
import { lineTotals } from "@/lib/domain/totals";
import { fulfilledQty, remainingQty } from "./_orders";
import { delay, matches, nowISO, paginate, takeRef, uid, type ListQuery, type ListResult } from "./_util";

export type OrderStatus = "ordered" | "partial" | "completed";
export type OrderFilters = ListQuery & { locationId?: string; contactId?: string; status?: OrderStatus; shippingStatus?: ShippingStatus; from?: string; to?: string };
export type OrderRow = {
  id: string; date: string; refNo: string; contactName: string; mobile: string; locationName: string; status: OrderStatus;
  shippingStatus: ShippingStatus | null; remainingQty: number; total: number; addedBy: string;
};
export type OrderDetail = {
  id: string; refNo: string; date: string; status: OrderStatus; total: number; notes: string; contactName: string; locationName: string;
  lines: { name: string; qty: number; fulfilled: number; unitPrice: number; subtotal: number }[];
};
export type OrderInput = {
  locationId: string; contactId: string; date?: string; note?: string;
  lines: { productId: string; variationId: string; unitId: string; qty: number; unitPrice: number }[];
};

export const ordersService = {
  async list(f: OrderFilters = {}): Promise<ListResult<OrderRow>> {
    await delay();
    const d = getDB();
    const rows = d.transactions
      .filter((t) => t.type === "sales_order")
      .filter((t) => !f.locationId || t.locationId === f.locationId)
      .filter((t) => !f.contactId || t.contactId === f.contactId)
      .filter((t) => !f.status || t.status === f.status)
      .filter((t) => !f.shippingStatus || t.shipping.status === f.shippingStatus)
      .filter((t) => !f.from || t.date.slice(0, 10) >= f.from)
      .filter((t) => !f.to || t.date.slice(0, 10) <= f.to)
      .filter((t) => matches(f.search, t.refNo, d.contacts.find((c) => c.id === t.contactId)?.name))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t): OrderRow => {
        const c = d.contacts.find((x) => x.id === t.contactId);
        const u = d.users.find((x) => x.id === t.createdBy);
        return {
          id: t.id, date: t.date, refNo: t.refNo, contactName: c?.name ?? "", mobile: c?.mobile ?? "",
          locationName: d.locations.find((l) => l.id === t.locationId)?.name ?? "", status: t.status as OrderStatus,
          shippingStatus: t.shipping.status, remainingQty: remainingQty(d, t), total: t.totals.total, addedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "",
        };
      });
    return paginate(rows, f);
  },

  async create(i: OrderInput): Promise<{ id: string; refNo: string }> {
    await delay();
    assertCan("sell.create");
    if (!i.lines.length || i.lines.some((l) => l.qty <= 0)) throw new ValidationError({ lines: "required" });
    let out!: { id: string; refNo: string };
    commit((d) => {
      if (!d.contacts.some((c) => c.id === i.contactId)) throw new NotFoundError("Contact");
      const at = i.date ?? nowISO();
      const lines = i.lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        const taxRate = d.taxRates.find((t) => t.id === p?.taxId)?.rate ?? 0;
        const taxType = p?.taxType ?? "exclusive";
        return {
          id: uid("l"), ...l, taxId: p?.taxId ?? null, taxRate, taxType,
          subtotal: lineTotals({ qty: l.qty, unitPrice: l.unitPrice, taxRate, taxType }).subtotal,
        };
      });
      const totals = orderTotals({ lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate, taxType: l.taxType })) });
      const refNo = takeRef(d, d.settings.prefixes.salesOrder, at);
      const id = uid("t");
      d.transactions.push(transaction.parse({
        id, createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, type: "sales_order", status: "ordered", locationId: i.locationId,
        contactId: i.contactId, refNo, date: at, lines, totals, paymentStatus: "due", notes: i.note ?? "",
      }));
      out = { id, refNo };
    });
    return out;
  },

  async get(id: string): Promise<OrderDetail> {
    await delay();
    const d = getDB();
    const o = d.transactions.find((t) => t.id === id && t.type === "sales_order");
    if (!o) throw new NotFoundError("Order");
    const names = (l: { productId: string; variationId: string }) => {
      const p = d.products.find((x) => x.id === l.productId);
      const v = d.variations.find((x) => x.id === l.variationId);
      return p ? (p.type === "variable" && v ? `${p.name} (${v.name})` : p.name) : l.productId;
    };
    return {
      id: o.id, refNo: o.refNo, date: o.date, status: o.status as OrderStatus, total: o.totals.total, notes: o.notes,
      contactName: d.contacts.find((c) => c.id === o.contactId)?.name ?? "", locationName: d.locations.find((l) => l.id === o.locationId)?.name ?? "",
      lines: o.lines.map((l) => ({ name: names(l), qty: l.qty, fulfilled: fulfilledQty(d, l.id), unitPrice: l.unitPrice, subtotal: l.subtotal })),
    };
  },

  /** Only an order nothing has been sold against can be deleted. */
  async remove(id: string): Promise<void> {
    await delay();
    assertCan("sell.delete");
    commit((d) => {
      const o = d.transactions.find((t) => t.id === id && t.type === "sales_order");
      if (!o) throw new NotFoundError("Order");
      if (o.lines.some((l) => fulfilledQty(d, l.id) > 0)) throw new AppError("Sales already draw from this order", "order_in_use");
      d.transactions = d.transactions.filter((t) => t.id !== id);
    });
  },

  /** Orders a customer can still draw from when adding a sale. */
  async openFor(contactId: string): Promise<OrderRow[]> {
    const { rows } = await ordersService.list({ contactId, pageSize: -1 });
    return rows.filter((r) => r.status !== "completed" && r.remainingQty > 0);
  },
};
