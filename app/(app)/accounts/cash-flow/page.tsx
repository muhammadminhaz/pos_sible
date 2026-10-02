import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { CashFlow } from "@/features/finance/CashFlow";

export default function Page() {
  return (
    <RequirePermission permission="account.view">
      <Suspense><CashFlow /></Suspense>
    </RequirePermission>
  );
}
