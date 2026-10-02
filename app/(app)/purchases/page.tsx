import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchasesList } from "@/features/operations/PurchasesList";

export default function Page() {
  return (
    <RequirePermission permission="purchase.view">
      <Suspense><PurchasesList /></Suspense>
    </RequirePermission>
  );
}
