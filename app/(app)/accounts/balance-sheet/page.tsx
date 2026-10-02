import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { BalanceSheet } from "@/features/finance/LedgerReports";

export default function Page() {
  return (
    <RequirePermission permission="account.view">
      <Suspense><BalanceSheet /></Suspense>
    </RequirePermission>
  );
}
