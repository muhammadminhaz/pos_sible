import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { AdjustmentsList } from "@/features/operations/Adjustments";

export default function Page() {
  return (
    <RequirePermission permission="stock_adjustment.view">
      <Suspense><AdjustmentsList /></Suspense>
    </RequirePermission>
  );
}
