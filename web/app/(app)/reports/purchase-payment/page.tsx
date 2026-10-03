import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchasePaymentReport } from "@/features/reports/ActivityReports";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><PurchasePaymentReport /></Suspense>
    </RequirePermission>
  );
}
