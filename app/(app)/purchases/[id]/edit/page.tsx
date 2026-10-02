import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { PurchaseFormPage } from "@/features/operations/PurchaseFormPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="purchase.update">
      <Suspense><PurchaseFormPage id={id} /></Suspense>
    </RequirePermission>
  );
}
