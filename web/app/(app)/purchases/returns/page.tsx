import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchaseReturnsList } from "@/features/operations/PurchaseReturns";

export default function Page() {
  return (
    <RequirePermission permission="purchase_return.view">
      <Suspense><PurchaseReturnsList /></Suspense>
    </RequirePermission>
  );
}
