import { RequirePermission } from "@/components/shared/Can";
import { ImportProductsPage } from "@/features/catalog/ImportPages";

export default function Page() {
  return (
    <RequirePermission permission="product.create">
      <ImportProductsPage />
    </RequirePermission>
  );
}
