"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productImportService } from "@/lib/data/services/productImport";
import { productsService, type OpeningStockRow, type ProductFilters, type ProductFormData } from "@/lib/data/services/products";
import { keys } from "./keys";

export function useProducts(f: ProductFilters) {
  return useQuery({ queryKey: keys.products.list(f), queryFn: () => productsService.list(f), placeholderData: keepPreviousData });
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: keys.products.detail(id ?? ""), queryFn: () => productsService.get(id!), enabled: !!id });
}

export function useProductForm(id: string | undefined) {
  return useQuery({ queryKey: [...keys.products.detail(id ?? ""), "form"], queryFn: () => productsService.getForm(id!), enabled: !!id, staleTime: 0, gcTime: 0 });
}

export function useNextSku() {
  return useQuery({ queryKey: [...keys.products.all, "next-sku"], queryFn: productsService.nextSku, staleTime: 0 });
}

export function useProductHistory(id: string | undefined) {
  return useQuery({ queryKey: [...keys.products.detail(id ?? ""), "history"], queryFn: () => productsService.history(id!), enabled: !!id });
}

export function useProductStock(id: string | undefined) {
  return useQuery({ queryKey: [...keys.products.detail(id ?? ""), "stock"], queryFn: () => productsService.stockByLocation(id!), enabled: !!id });
}

export function useCatalogImports(kind: "products" | "opening_stock" | "prices" | "contacts") {
  return useQuery({ queryKey: ["importBatches", "catalog", kind], queryFn: () => productImportService.history(kind) });
}

export function useProductMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: keys.products.all });
  return {
    create: useMutation({ mutationFn: (input: ProductFormData) => productsService.create(input), onSuccess: done }),
    update: useMutation({ mutationFn: (a: { id: string; input: ProductFormData }) => productsService.update(a.id, a.input), onSuccess: done }),
    addOpeningStock: useMutation({
      mutationFn: (a: { id: string; rows: OpeningStockRow[] }) => productsService.addOpeningStock(a.id, a.rows),
      onSuccess: () => Promise.all([done(), qc.invalidateQueries({ queryKey: ["stockLots"] }), qc.invalidateQueries({ queryKey: ["transactions"] })]),
    }),
    setActive: useMutation({ mutationFn: (a: { ids: string[]; active: boolean }) => productsService.setActive(a.ids, a.active), onSuccess: done }),
    remove: useMutation({ mutationFn: (ids: string[]) => productsService.remove(ids), onSuccess: done }),
    setLocations: useMutation({
      mutationFn: (a: { ids: string[]; locationIds: string[]; mode: "add" | "remove" }) => productsService.setLocations(a.ids, a.locationIds, a.mode),
      onSuccess: done,
    }),
  };
}
