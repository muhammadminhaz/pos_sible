import { RequirePermission } from "@/components/shared/Can";
import { ExpenseCategoriesPage } from "@/features/finance/ExpenseCategories";

export default function Page() {
  return (
    <RequirePermission permission="expense.view">
      <ExpenseCategoriesPage />
    </RequirePermission>
  );
}
