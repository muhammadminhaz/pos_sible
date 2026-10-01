import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ProductDetail } from "@/features/catalog/ProductDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="product.view">
      <Suspense><ProductDetail id={id} /></Suspense>
    </RequirePermission>
  );
}
