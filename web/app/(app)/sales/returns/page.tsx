import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ReturnsList } from "@/features/sales/ReturnsList";

export default function Page() {
  return (
    <RequirePermission permission="sell_return.view">
      <Suspense>
        <ReturnsList />
      </Suspense>
    </RequirePermission>
  );
}
