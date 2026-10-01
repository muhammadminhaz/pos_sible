import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { OrdersList } from "@/features/sales/OrdersList";

export default function Page() {
  return (
    <RequirePermission permission="sales_order.view">
      <Suspense>
        <OrdersList />
      </Suspense>
    </RequirePermission>
  );
}
