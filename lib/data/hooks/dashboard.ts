"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardService, type KpiFilters } from "@/lib/data/services/dashboard";
import { keys } from "./keys";

export function useDashboardKpis(f: KpiFilters) {
  return useQuery({ queryKey: keys.dashboard(f), queryFn: () => dashboardService.kpis(f), placeholderData: keepPreviousData });
}
