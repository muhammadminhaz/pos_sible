"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Row, TableName } from "@/lib/data/schemas";
import { crud } from "@/lib/data/services/catalog";
import type { ListQuery } from "@/lib/data/services/_util";
import { keys } from "./keys";

type Entity<N extends TableName> = Row<N> & { id: string };

/** List + CRUD mutations for any simple table (units, brands, tax rates…). */
export function useCrud<N extends TableName>(table: N, q: ListQuery = { pageSize: -1 }) {
  const qc = useQueryClient();
  const svc = useMemo(() => crud<N, Entity<N>>(table), [table]);
  const k = keys.table(table);
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: k.all }), qc.invalidateQueries({ queryKey: keys.lookups })]);
  return {
    list: useQuery({ queryKey: k.list(q), queryFn: () => svc.list(q), placeholderData: keepPreviousData }),
    create: useMutation({ mutationFn: (data: Omit<Entity<N>, "id" | "createdAt" | "createdBy">) => svc.create(data), onSuccess: done }),
    update: useMutation({ mutationFn: (a: { id: string; patch: Partial<Entity<N>> }) => svc.update(a.id, a.patch), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => svc.remove(id), onSuccess: done }),
  };
}
