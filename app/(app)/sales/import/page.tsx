import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ImportSales } from "@/features/sales/ImportSales";

export default function Page() {
  return (
    <RequirePermission permission="sell.import">
      <Suspense>
        <ImportSales />
      </Suspense>
    </RequirePermission>
  );
}
