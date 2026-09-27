import { commit, getDB } from "@/lib/data/store/db";
import { NotFoundError } from "@/lib/data/errors";
import type { Row, TableName } from "@/lib/data/schemas";
import { useSession } from "@/lib/auth/session";
import { delay, matches, nowISO, paginate, uid, type ListQuery, type ListResult } from "./_util";

export type CrudService<T extends { id: string }> = {
  list(q?: ListQuery): Promise<ListResult<T>>;
  all(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: Omit<T, "id" | "createdAt" | "createdBy">): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
};

/** Generic CRUD over one table. Search looks at `name`, `code`, and `shortName` when present. */
export function crud<N extends TableName, T extends Row<N> & { id: string } = Row<N>>(table: N): CrudService<T> {
  const rows = () => getDB()[table] as unknown as T[];
  const find = (id: string) => {
    const row = rows().find((r) => r.id === id);
    if (!row) throw new NotFoundError();
    return row;
  };
  return {
    async list(q = {}) {
      await delay();
      const filtered = rows().filter((r) => {
        const o = r as unknown as Record<string, string | undefined>;
        return matches(q.search, o.name, o.code, o.shortName);
      });
      return paginate(filtered, q);
    },
    async all() {
      await delay();
      return rows();
    },
    async get(id) {
      await delay();
      return find(id);
    },
    async create(data) {
      await delay();
      const row = { ...data, id: uid(table.slice(0, 3)), createdAt: nowISO(), createdBy: useSession.getState().userId } as unknown as T;
      commit((d) => void (d[table] as unknown as T[]).push(row));
      return row;
    },
    async update(id, patch) {
      await delay();
      find(id);
      let next!: T;
      commit((d) => {
        const list = d[table] as unknown as T[];
        const i = list.findIndex((r) => r.id === id);
        next = { ...list[i], ...patch, id };
        list[i] = next;
      });
      return next;
    },
    async remove(id) {
      await delay();
      find(id);
      commit((d) => {
        const tables = d as unknown as Record<N, T[]>;
        tables[table] = tables[table].filter((r) => r.id !== id);
      });
    },
  };
}
