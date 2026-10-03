import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { SaleFormPage } from "@/features/sales/SaleFormPage";

export default function Page() {
  return (
    <RequirePermission permission="sell.create">
      <Suspense><SaleFormPage /></Suspense>
    </RequirePermission>
  );
}
