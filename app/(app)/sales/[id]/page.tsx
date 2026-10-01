import { RequirePermission } from "@/components/shared/Can";
import { SaleDetail } from "@/features/sales/SaleDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="sell.view">
      <SaleDetail id={id} />
    </RequirePermission>
  );
}
