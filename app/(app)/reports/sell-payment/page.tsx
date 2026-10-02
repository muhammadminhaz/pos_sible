import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { SellPaymentReport } from "@/features/reports/ActivityReports";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><SellPaymentReport /></Suspense>
    </RequirePermission>
  );
}
