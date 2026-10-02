"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsService } from "@/lib/data/services/accounts";
import { expensesService, type ExpenseFilters } from "@/lib/data/services/expenses";
import { ledgerReportsService } from "@/lib/data/services/ledgerReports";
import type { CashFlowFilter, ReportFilter } from "@/lib/domain/ledger";

/** Expenses move money, so every mutation refreshes the tables the ledger screens read. */
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["transactions", "accountTxns", "accounts", "cashRegisters", "reports"].map((t) => qc.invalidateQueries({ queryKey: [t] })));
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

export function useAccounts(f: { status?: "active" | "closed"; search?: string } = {}) {
  return useQuery({ queryKey: ["accounts", "list", f], queryFn: () => accountsService.list(f), placeholderData: keepPreviousData });
}

export function useAccount(id: string | undefined) {
  return useQuery({ queryKey: ["accounts", "detail", id], queryFn: () => accountsService.get(id!), enabled: !!id });
}

export function useAccountBook(id: string | undefined, range: { from?: string; to?: string }) {
  return useQuery({ queryKey: ["accountTxns", "book", id, range], queryFn: () => accountsService.book(id!, range), enabled: !!id, placeholderData: keepPreviousData });
}

export function useAccountMutations() {
  const qc = useQueryClient();
  const done = () => Promise.all(["accounts", "accountTxns", "lookups", "reports"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  return {
    save: useMutation({ mutationFn: accountsService.save, onSuccess: done }),
    close: useMutation({ mutationFn: (id: string) => accountsService.close(id), onSuccess: done }),
    reopen: useMutation({ mutationFn: (id: string) => accountsService.reopen(id), onSuccess: done }),
    transfer: useMutation({ mutationFn: accountsService.transfer, onSuccess: done }),
    deposit: useMutation({ mutationFn: accountsService.deposit, onSuccess: done }),
  };
}

export function useTrialBalance(f: ReportFilter) {
  return useQuery({ queryKey: ["reports", "trial-balance", f], queryFn: () => ledgerReportsService.trialBalance(f), placeholderData: keepPreviousData });
}

export function useBalanceSheet(f: ReportFilter) {
  return useQuery({ queryKey: ["reports", "balance-sheet", f], queryFn: () => ledgerReportsService.balanceSheet(f), placeholderData: keepPreviousData });
}

export function useCashFlow(f: CashFlowFilter) {
  return useQuery({ queryKey: ["reports", "cash-flow", f], queryFn: () => ledgerReportsService.cashFlow(f), placeholderData: keepPreviousData });
}
