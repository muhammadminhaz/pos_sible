import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ReturnForm } from "@/features/sales/ReturnForm";

export default function Page() {
  return (
    <RequirePermission permission="sell.create">
      <Suspense>
        <ReturnForm />
      </Suspense>
    </RequirePermission>
  );
}
