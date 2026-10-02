import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchaseSale } from "@/features/reports/PurchaseSaleTax";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><PurchaseSale /></Suspense>
    </RequirePermission>
  );
}
