"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adjustmentsService, type AdjustmentFilters } from "@/lib/data/services/adjustments";
import { purchaseReturnsService, type PurchaseReturnFilters } from "@/lib/data/services/purchaseReturns";
import { purchasesService, type PurchaseFilters } from "@/lib/data/services/purchases";
import { transfersService, type TransferFilters } from "@/lib/data/services/transfers";

/** Purchases, transfers and adjustments all move stock and money, so every mutation refreshes those tables. */
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["transactions", "products", "contacts", "stockLots", "accountTxns"].map((t) => qc.invalidateQueries({ queryKey: [t] })));
}

export function usePurchases(f: PurchaseFilters) {
  return useQuery({ queryKey: ["transactions", "purchases", f], queryFn: () => purchasesService.list(f), placeholderData: keepPreviousData });
}
export function usePurchase(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "purchase", id], queryFn: () => purchasesService.get(id!), enabled: !!id });
}
export function usePurchaseForm(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "purchase-form", id], queryFn: () => purchasesService.getForm(id!), enabled: !!id, staleTime: 0, gcTime: 0 });
}
export function usePurchaseMutations() {
  const done = useRefresh();
  return {
    save: useMutation({ mutationFn: purchasesService.save, onSuccess: done }),
    setStatus: useMutation({ mutationFn: (a: { id: string; status: Parameters<typeof purchasesService.setStatus>[1] }) => purchasesService.setStatus(a.id, a.status), onSuccess: done }),
    addPayment: useMutation({ mutationFn: (a: { id: string; payment: Parameters<typeof purchasesService.addPayment>[1] }) => purchasesService.addPayment(a.id, a.payment), onSuccess: done }),
    removePayment: useMutation({ mutationFn: (a: { id: string; paymentId: string }) => purchasesService.removePayment(a.id, a.paymentId), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => purchasesService.remove(id), onSuccess: done }),
  };
}

export function usePurchaseReturns(f: PurchaseReturnFilters) {
  return useQuery({ queryKey: ["transactions", "purchase-returns", f], queryFn: () => purchaseReturnsService.list(f), placeholderData: keepPreviousData });
}
export function usePurchaseReturnLines(purchaseId: string | undefined) {
  return useQuery({ queryKey: ["transactions", "purchase-return-lines", purchaseId], queryFn: () => purchaseReturnsService.parentLines(purchaseId!), enabled: !!purchaseId, gcTime: 0 });
}
export function usePurchaseReturnMutations() {
  const done = useRefresh();
  return {
    create: useMutation({ mutationFn: purchaseReturnsService.create, onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => purchaseReturnsService.remove(id), onSuccess: done }),
  };
}

export function useTransfers(f: TransferFilters) {
  return useQuery({ queryKey: ["transactions", "transfers", f], queryFn: () => transfersService.list(f), placeholderData: keepPreviousData });
}
export function useTransfer(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "transfer", id], queryFn: () => transfersService.get(id!), enabled: !!id });
}
export function useTransferMutations() {
  const done = useRefresh();
  return {
    create: useMutation({ mutationFn: transfersService.create, onSuccess: done }),
    updateStatus: useMutation({ mutationFn: (a: { id: string; status: Parameters<typeof transfersService.updateStatus>[1] }) => transfersService.updateStatus(a.id, a.status), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => transfersService.remove(id), onSuccess: done }),
  };
}

export function useAdjustments(f: AdjustmentFilters) {
  return useQuery({ queryKey: ["transactions", "adjustments", f], queryFn: () => adjustmentsService.list(f), placeholderData: keepPreviousData });
}
export function useAdjustment(id: string | null) {
  return useQuery({ queryKey: ["transactions", "adjustment", id], queryFn: () => adjustmentsService.get(id!), enabled: !!id });
}
export function useAdjustmentMutations() {
  const done = useRefresh();
  return {
    create: useMutation({ mutationFn: adjustmentsService.create, onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => adjustmentsService.remove(id), onSuccess: done }),
  };
}
