import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ExpenseFormPage } from "@/features/finance/ExpenseFormPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="expense.update">
      <Suspense><ExpenseFormPage id={id} /></Suspense>
    </RequirePermission>
  );
}
