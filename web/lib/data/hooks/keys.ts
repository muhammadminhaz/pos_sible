import type { TableName } from "@/lib/data/schemas";

/** Query keys start with the table name so a mutation can invalidate `[table]` wholesale. */
export const keys = {
  products: {
    all: ["products"] as const,
    list: (f: object) => ["products", "list", f] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: (f: object) => ["contacts", "list", f] as const,
    detail: (id: string) => ["contacts", "detail", id] as const,
  },
  table: (t: TableName) => ({
    all: [t] as const,
    list: (q: object) => [t, "list", q] as const,
    detail: (id: string) => [t, "detail", id] as const,
  }),
  lookups: ["lookups"] as const,
  settings: ["settings"] as const,
  backups: ["backups"] as const,
  dashboard: (f: object) => ["transactions", "dashboard", f] as const,
  pos: {
    products: (q: object) => ["products", "pos", q] as const,
    search: (q: object) => ["products", "pos-search", q] as const,
    register: (loc: string) => ["cashRegisters", "current", loc] as const,
    registerSummary: (id: string) => ["transactions", "register-summary", id] as const,
    sales: (q: object) => ["transactions", "pos-sales", q] as const,
    receipt: (id: string) => ["transactions", "receipt", id] as const,
    customers: (term: string) => ["contacts", "pos", term] as const,
  },
};
