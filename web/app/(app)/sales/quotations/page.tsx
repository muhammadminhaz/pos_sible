import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { SalesList } from "@/features/sales/SalesList";

export default function Page() {
  return (
    <RequirePermission permission="quotation.view">
      <Suspense>
        <SalesList kind="quotations" />
      </Suspense>
    </RequirePermission>
  );
}
