import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { TrialBalance } from "@/features/finance/LedgerReports";

export default function Page() {
  return (
    <RequirePermission permission="account.view">
      <Suspense><TrialBalance /></Suspense>
    </RequirePermission>
  );
}
