import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { DiscountsList } from "@/features/sales/DiscountsList";

export default function Page() {
  return (
    <RequirePermission permission="discount.view">
      <Suspense>
        <DiscountsList />
      </Suspense>
    </RequirePermission>
  );
}
