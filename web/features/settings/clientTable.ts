import { matches, paginate } from "@/lib/data/services/_util";
import type { TableQuery } from "@/components/shared/DataTable";

/** Search, sort and page an in-memory list the way the server-backed tables do. */
export function clientPage<T>(rows: T[], q: TableQuery, text: (r: T) => (string | undefined)[]) {
  return paginate(rows.filter((r) => matches(q.search, ...text(r))), q);
}
