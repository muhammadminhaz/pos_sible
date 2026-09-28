"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsService, type NewCustomer } from "@/lib/data/services/contacts";
import { expensesService, type NewExpense } from "@/lib/data/services/expenses";
import { posService, type PosCatalogQuery } from "@/lib/data/services/pos";
import { registersService, type CloseRegisterInput } from "@/lib/data/services/registers";
import { salesService, type CheckoutInput, type SaleStatus } from "@/lib/data/services/sales";
import { keys } from "./keys";

type SearchQuery = { locationId: string; contactId?: string; term: string };

export function usePosProducts(q: PosCatalogQuery) {
  return useQuery({ queryKey: keys.pos.products(q), queryFn: () => posService.products(q), placeholderData: keepPreviousData });
}

export function usePosSearch(q: SearchQuery) {
  return useQuery({ queryKey: keys.pos.search(q), queryFn: () => posService.search(q), enabled: q.term.trim().length > 0, placeholderData: keepPreviousData });
}

/** Imperative search for Enter/scanner input, where the deferred query may lag behind. */
export function usePosLookup() {
  const qc = useQueryClient();
  return (q: SearchQuery) => qc.fetchQuery({ queryKey: keys.pos.search(q), queryFn: () => posService.search(q) });
}

export function useCurrentRegister(locationId: string) {
  return useQuery({ queryKey: keys.pos.register(locationId), queryFn: () => registersService.current(locationId), enabled: !!locationId });
}

export function useRegisterSummary(id: string | undefined) {
  return useQuery({ queryKey: keys.pos.registerSummary(id ?? ""), queryFn: () => registersService.summary(id!), enabled: !!id });
}

export function usePosSales(q: { locationId: string; status: SaleStatus; limit?: number }, enabled = true) {
  return useQuery({ queryKey: keys.pos.sales(q), queryFn: () => salesService.list(q), enabled });
}

export function useReceipt(id: string | null | undefined) {
  return useQuery({ queryKey: keys.pos.receipt(id ?? ""), queryFn: () => salesService.receipt(id!), enabled: !!id });
}

export function usePosCustomers(term: string) {
  return useQuery({
    queryKey: keys.pos.customers(term),
    queryFn: () => contactsService.list({ type: "customer", active: "active", search: term, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
}

export function usePosMutations() {
  const qc = useQueryClient();
  // A sale touches products (stock), contacts (points/due), transactions and registers; refetch everything.
  const all = () => qc.invalidateQueries();
  return {
    checkout: useMutation({ mutationFn: (i: CheckoutInput) => salesService.checkout(i), onSuccess: all }),
    remove: useMutation({ mutationFn: (id: string) => salesService.remove(id), onSuccess: all }),
    loadCart: useMutation({ mutationFn: (id: string) => salesService.toCart(id) }),
    openRegister: useMutation({ mutationFn: (a: { locationId: string; openingCash: number }) => registersService.open(a.locationId, a.openingCash), onSuccess: all }),
    closeRegister: useMutation({ mutationFn: (a: { id: string } & CloseRegisterInput) => registersService.close(a.id, a), onSuccess: all }),
    createExpense: useMutation({ mutationFn: (i: NewExpense) => expensesService.create(i), onSuccess: all }),
    createCustomer: useMutation({ mutationFn: (i: NewCustomer) => contactsService.createCustomer(i), onSuccess: () => qc.invalidateQueries({ queryKey: keys.contacts.all }) }),
  };
}
