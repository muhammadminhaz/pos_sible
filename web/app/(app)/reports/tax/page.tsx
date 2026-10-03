import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { TaxReport } from "@/features/reports/PurchaseSaleTax";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><TaxReport /></Suspense>
    </RequirePermission>
  );
}
