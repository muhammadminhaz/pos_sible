import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { SaleFormPage } from "@/features/sales/SaleFormPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="sell.update">
      <Suspense>
        <SaleFormPage id={id} />
      </Suspense>
    </RequirePermission>
  );
}
