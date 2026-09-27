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
  dashboard: (f: object) => ["transactions", "dashboard", f] as const,
};
