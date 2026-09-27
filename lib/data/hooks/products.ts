"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productsService, type ProductFilters } from "@/lib/data/services/products";
import { keys } from "./keys";

export function useProducts(f: ProductFilters) {
  return useQuery({ queryKey: keys.products.list(f), queryFn: () => productsService.list(f), placeholderData: keepPreviousData });
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: keys.products.detail(id ?? ""), queryFn: () => productsService.get(id!), enabled: !!id });
}

export function useProductMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: keys.products.all });
  return {
    setActive: useMutation({ mutationFn: (a: { ids: string[]; active: boolean }) => productsService.setActive(a.ids, a.active), onSuccess: done }),
    remove: useMutation({ mutationFn: (ids: string[]) => productsService.remove(ids), onSuccess: done }),
    setLocations: useMutation({
      mutationFn: (a: { ids: string[]; locationIds: string[]; mode: "add" | "remove" }) => productsService.setLocations(a.ids, a.locationIds, a.mode),
      onSuccess: done,
    }),
  };
}
