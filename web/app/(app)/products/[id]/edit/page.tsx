import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ProductFormPage } from "@/features/catalog/ProductFormPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="product.update">
      <Suspense><ProductFormPage id={id} /></Suspense>
    </RequirePermission>
  );
}
