"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { discountsService, type DiscountFilters } from "@/lib/data/services/discounts";
import { ordersService, type OrderFilters } from "@/lib/data/services/orders";
import { returnsService, type ReturnFilters } from "@/lib/data/services/returns";
import { salesService, type SaleFilters } from "@/lib/data/services/sales";
import { salesImportService } from "@/lib/data/services/salesImport";

/** Sales touch stock, customer points/due and the ledger, so mutations refresh those tables too. */
function useRefresh(...tables: string[]) {
  const qc = useQueryClient();
  return () => Promise.all(["transactions", "products", "contacts", ...tables].map((t) => qc.invalidateQueries({ queryKey: [t] })));
}

export function useSalesList(f: SaleFilters) {
  return useQuery({ queryKey: ["transactions", "sales", f], queryFn: () => salesService.listAll(f), placeholderData: keepPreviousData });
}

export function useSale(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "sale", id], queryFn: () => salesService.get(id!), enabled: !!id });
}

export function useSaleCart(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "sale-cart", id], queryFn: () => salesService.toCart(id!, true), enabled: !!id, gcTime: 0 });
}

export function useSaleMutations() {
  const done = useRefresh("accountTxns");
  return {
    save: useMutation({ mutationFn: salesService.save, onSuccess: done }),
    convert: useMutation({ mutationFn: (a: { id: string; payments?: Parameters<typeof salesService.convert>[1] }) => salesService.convert(a.id, a.payments), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => salesService.removeAny(id), onSuccess: done }),
    generateNext: useMutation({ mutationFn: (id: string) => salesService.generateNext(id), onSuccess: done }),
    addPayment: useMutation({ mutationFn: (a: { id: string; payment: Parameters<typeof salesService.addPayment>[1] }) => salesService.addPayment(a.id, a.payment), onSuccess: done }),
    removePayment: useMutation({ mutationFn: (a: { id: string; paymentId: string }) => salesService.removePayment(a.id, a.paymentId), onSuccess: done }),
    setShipping: useMutation({ mutationFn: (a: { id: string; patch: Parameters<typeof salesService.setShipping>[1] }) => salesService.setShipping(a.id, a.patch), onSuccess: done }),
  };
}

export function useOrders(f: OrderFilters) {
  return useQuery({ queryKey: ["transactions", "orders", f], queryFn: () => ordersService.list(f), placeholderData: keepPreviousData });
}

export function useOpenOrders(contactId: string | undefined) {
  return useQuery({ queryKey: ["transactions", "open-orders", contactId], queryFn: () => ordersService.openFor(contactId!), enabled: !!contactId });
}

export function useOrderMutations() {
  const done = useRefresh();
  return { create: useMutation({ mutationFn: ordersService.create, onSuccess: done }) };
}

export function useReturns(f: ReturnFilters) {
  return useQuery({ queryKey: ["transactions", "returns", f], queryFn: () => returnsService.list(f), placeholderData: keepPreviousData });
}

export function useReturnableLines(saleId: string | undefined) {
  return useQuery({ queryKey: ["transactions", "returnable", saleId], queryFn: () => returnsService.parentLines(saleId!), enabled: !!saleId });
}

export function useReturnMutations() {
  const done = useRefresh("accountTxns");
  return {
    create: useMutation({ mutationFn: returnsService.create, onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => returnsService.remove(id), onSuccess: done }),
  };
}

export function useDiscounts(f: DiscountFilters) {
  return useQuery({ queryKey: ["discounts", "list", f], queryFn: () => discountsService.list(f), placeholderData: keepPreviousData });
}

export function useDiscountMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["discounts"] });
  return {
    save: useMutation({ mutationFn: discountsService.save, onSuccess: done }),
    setActive: useMutation({ mutationFn: (a: { ids: string[]; active: boolean }) => discountsService.setActive(a.ids, a.active), onSuccess: done }),
    remove: useMutation({ mutationFn: (ids: string[]) => discountsService.remove(ids), onSuccess: done }),
  };
}

export function useImportHistory() {
  return useQuery({ queryKey: ["importBatches", "sales"], queryFn: () => salesImportService.history() });
}

export function useImportMutations() {
  const done = useRefresh("importBatches");
  return {
    parse: useMutation({ mutationFn: (csv: string) => salesImportService.parse(csv) }),
    commit: useMutation({ mutationFn: (a: { rows: Parameters<typeof salesImportService.commit>[0]; fileName: string }) => salesImportService.commit(a.rows, a.fileName), onSuccess: done }),
    revert: useMutation({ mutationFn: (id: string) => salesImportService.revert(id), onSuccess: done }),
  };
}
