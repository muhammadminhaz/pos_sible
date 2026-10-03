import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { TransfersList } from "@/features/operations/Transfers";

export default function Page() {
  return (
    <RequirePermission permission="stock_transfer.view">
      <Suspense><TransfersList /></Suspense>
    </RequirePermission>
  );
}
