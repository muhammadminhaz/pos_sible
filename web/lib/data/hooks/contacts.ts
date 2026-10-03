"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsService, type ContactFilters, type ContactInput } from "@/lib/data/services/contacts";
import type { PaymentMethod } from "@/lib/data/schemas";
import { keys } from "./keys";

export function useContacts(f: ContactFilters) {
  return useQuery({ queryKey: keys.contacts.list(f), queryFn: () => contactsService.list(f), placeholderData: keepPreviousData });
}

export function useContact(id: string | undefined) {
  return useQuery({ queryKey: keys.contacts.detail(id ?? ""), queryFn: () => contactsService.get(id!), enabled: !!id });
}

export function useContactLedger(id: string | undefined) {
  return useQuery({ queryKey: ["contacts", "ledger", id], queryFn: () => contactsService.ledger(id!), enabled: !!id });
}

export function useContactMutations() {
  const qc = useQueryClient();
  const refresh = () => Promise.all(["contacts", "transactions", "accountTxns", "lookups"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  return {
    save: useMutation({ mutationFn: (input: ContactInput) => contactsService.save(input), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (ids: string[]) => contactsService.remove(ids), onSuccess: refresh }),
    payDue: useMutation({
      mutationFn: (a: { id: string; amount: number; method: PaymentMethod; note?: string }) => contactsService.payDue(a.id, { amount: a.amount, method: a.method, note: a.note }),
      onSuccess: refresh,
    }),
    setActive: useMutation({
      mutationFn: (a: { ids: string[]; active: boolean }) => contactsService.setActive(a.ids, a.active),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.contacts.all }),
    }),
  };
}
