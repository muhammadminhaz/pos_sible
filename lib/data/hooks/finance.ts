"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expensesService, type ExpenseFilters } from "@/lib/data/services/expenses";

/** Expenses move money, so every mutation refreshes the tables the ledger screens read. */
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["transactions", "accountTxns", "accounts", "cashRegisters"].map((t) => qc.invalidateQueries({ queryKey: [t] })));
}

export function useExpenses(f: ExpenseFilters) {
  return useQuery({ queryKey: ["transactions", "expenses", f], queryFn: () => expensesService.list(f), placeholderData: keepPreviousData });
}

export function useExpense(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "expense", id], queryFn: () => expensesService.get(id!), enabled: !!id });
}

export function useExpenseForm(id: string | undefined) {
  return useQuery({ queryKey: ["transactions", "expense-form", id], queryFn: () => expensesService.getForm(id!), enabled: !!id });
}

export function useExpenseMutations() {
  const done = useRefresh();
  return {
    save: useMutation({ mutationFn: expensesService.save, onSuccess: done }),
    addPayment: useMutation({ mutationFn: (a: { id: string; payment: Parameters<typeof expensesService.addPayment>[1] }) => expensesService.addPayment(a.id, a.payment), onSuccess: done }),
    removePayment: useMutation({ mutationFn: (a: { id: string; paymentId: string }) => expensesService.removePayment(a.id, a.paymentId), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => expensesService.remove(id), onSuccess: done }),
    generateNext: useMutation({ mutationFn: (id: string) => expensesService.generateNext(id), onSuccess: done }),
  };
}
