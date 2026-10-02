import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchaseDetail } from "@/features/operations/PurchaseDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="purchase.view">
      <Suspense><PurchaseDetail id={id} /></Suspense>
    </RequirePermission>
  );
}
