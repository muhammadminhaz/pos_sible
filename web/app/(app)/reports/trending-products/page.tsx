import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { TrendingProducts } from "@/features/reports/ProductReports";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><TrendingProducts /></Suspense>
    </RequirePermission>
  );
}
