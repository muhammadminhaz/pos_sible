import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ProductFormPage } from "@/features/catalog/ProductFormPage";

export default function Page() {
  return (
    <RequirePermission permission="product.create">
      <Suspense><ProductFormPage /></Suspense>
    </RequirePermission>
  );
}
