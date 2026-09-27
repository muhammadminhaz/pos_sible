"use client";

import { useQuery } from "@tanstack/react-query";
import { lookupsService } from "@/lib/data/services/lookups";
import { keys } from "./keys";

export function useLookups() {
  return useQuery({ queryKey: keys.lookups, queryFn: lookupsService.all, staleTime: 5 * 60_000 });
}
