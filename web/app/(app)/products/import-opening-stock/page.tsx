import { RequirePermission } from "@/components/shared/Can";
import { ImportOpeningStockPage } from "@/features/catalog/ImportPages";

export default function Page() {
  return (
    <RequirePermission permission="product.opening_stock">
      <ImportOpeningStockPage />
    </RequirePermission>
  );
}
