import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchaseFormPage } from "@/features/operations/PurchaseFormPage";

export default function Page() {
  return (
    <RequirePermission permission="purchase.create">
      <Suspense><PurchaseFormPage /></Suspense>
    </RequirePermission>
  );
}
