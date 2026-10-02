import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PaymentAccountReport } from "@/features/finance/PaymentAccountReport";

export default function Page() {
  return (
    <RequirePermission permission="account.view">
      <Suspense><PaymentAccountReport /></Suspense>
    </RequirePermission>
  );
}
