import { RequirePermission } from "@/components/shared/Can";
import { TransferDetail } from "@/features/operations/Transfers";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="stock_transfer.view">
      <TransferDetail id={id} />
    </RequirePermission>
  );
}
