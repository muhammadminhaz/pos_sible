import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { StockReport } from "@/features/reports/StockReports";

export default function Page() {
  return (
    <RequirePermission permission="report.stock">
      <Suspense><StockReport /></Suspense>
    </RequirePermission>
  );
}
