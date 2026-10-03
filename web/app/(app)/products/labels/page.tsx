import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { Labels } from "@/features/catalog/Labels";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <Suspense><Labels /></Suspense>
    </RequirePermission>
  );
}
