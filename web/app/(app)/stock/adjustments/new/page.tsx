import { RequirePermission } from "@/components/shared/Can";
import { AdjustmentForm } from "@/features/operations/Adjustments";

export default function Page() {
  return (
    <RequirePermission permission="stock_adjustment.create">
      <AdjustmentForm />
    </RequirePermission>
  );
}
