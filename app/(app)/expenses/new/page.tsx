import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ExpenseFormPage } from "@/features/finance/ExpenseFormPage";

export default function Page() {
  return (
    <RequirePermission permission="expense.create">
      <Suspense><ExpenseFormPage /></Suspense>
    </RequirePermission>
  );
}
