"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useExpenseForm } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { useUI } from "@/lib/data/store/ui";
import { ExpenseForm, nowStamp } from "./ExpenseForm";

export function ExpenseFormPage({ id }: { id?: string }) {
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const form = useExpenseForm(id);
  const locationId = useUI((s) => s.locationId);
  if (!lookups || !settings || (id && !form.data)) return <Skeleton className="h-96" />;
  const blank = {
    locationId: locationId === "all" ? (lookups.locations[0]?.id ?? "") : locationId, categoryId: "", subCategoryId: null, date: nowStamp(new Date()),
    forUserId: null, contactId: null, taxId: null, amount: 0, note: "", isRefund: false, recurring: null, documents: [],
  };
  return <ExpenseForm key={id ?? "new"} id={id} init={form.data ?? blank} />;
}
