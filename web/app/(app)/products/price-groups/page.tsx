import { RequirePermission } from "@/components/shared/Can";
import { PriceGroupsPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <PriceGroupsPage />
    </RequirePermission>
  );
}
