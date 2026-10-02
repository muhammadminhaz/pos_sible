import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { AccountsList } from "@/features/finance/AccountsList";

export default function Page() {
  return (
    <RequirePermission permission="account.view">
      <Suspense><AccountsList /></Suspense>
    </RequirePermission>
  );
}
