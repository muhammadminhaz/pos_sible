import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ExpensesList } from "@/features/finance/ExpensesList";

export default function Page() {
  return (
    <RequirePermission permission="expense.view">
      <Suspense><ExpensesList /></Suspense>
    </RequirePermission>
  );
}
