"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

/**
 * One query per report. The key starts with `transactions` (reports read every table, and the mutations that change
 * them all invalidate it), then the report name and its filters.
 */
export function useReport<T>(name: string, filter: object, fn: () => Promise<T>, enabled = true) {
  return useQuery({ queryKey: ["transactions", "report", name, filter], queryFn: fn, placeholderData: keepPreviousData, enabled });
}
