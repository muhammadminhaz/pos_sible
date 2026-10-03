import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ProductsList } from "@/features/products/ProductsList";

export default function ProductsPage() {
  return (
    <RequirePermission permission="product.view">
      <Suspense>
        <ProductsList />
      </Suspense>
    </RequirePermission>
  );
}
