import { RequirePermission } from "@/components/shared/Can";
import { TransferForm } from "@/features/operations/Transfers";

export default function Page() {
  return (
    <RequirePermission permission="stock_transfer.create">
      <TransferForm />
    </RequirePermission>
  );
}
