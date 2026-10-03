import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchaseReturnForm } from "@/features/operations/PurchaseReturns";

export default function Page() {
  return (
    <RequirePermission permission="purchase.update">
      <Suspense><PurchaseReturnForm /></Suspense>
    </RequirePermission>
  );
}
