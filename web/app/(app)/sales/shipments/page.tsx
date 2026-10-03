import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ShipmentsList } from "@/features/sales/ShipmentsList";

export default function Page() {
  return (
    <RequirePermission permission="shipment.view">
      <Suspense>
        <ShipmentsList />
      </Suspense>
    </RequirePermission>
  );
}
