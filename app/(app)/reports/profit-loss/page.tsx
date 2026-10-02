import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ProfitLoss } from "@/features/reports/ProfitLoss";

export default function Page() {
  return (
    <RequirePermission permission="report.profit_loss">
      <Suspense><ProfitLoss /></Suspense>
    </RequirePermission>
  );
}
