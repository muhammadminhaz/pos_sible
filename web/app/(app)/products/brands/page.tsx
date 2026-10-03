import { RequirePermission } from "@/components/shared/Can";
import { BrandsPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <BrandsPage />
    </RequirePermission>
  );
}
