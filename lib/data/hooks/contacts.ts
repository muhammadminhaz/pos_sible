"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactsService, type ContactFilters } from "@/lib/data/services/contacts";
import { keys } from "./keys";

export function useContacts(f: ContactFilters) {
  return useQuery({ queryKey: keys.contacts.list(f), queryFn: () => contactsService.list(f), placeholderData: keepPreviousData });
}

export function useContact(id: string | undefined) {
  return useQuery({ queryKey: keys.contacts.detail(id ?? ""), queryFn: () => contactsService.get(id!), enabled: !!id });
}

export function useContactMutations() {
  const qc = useQueryClient();
  return {
    setActive: useMutation({
      mutationFn: (a: { ids: string[]; active: boolean }) => contactsService.setActive(a.ids, a.active),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.contacts.all }),
    }),
  };
}
