import { RequirePermission } from "@/components/shared/Can";
import { UnitsPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <UnitsPage />
    </RequirePermission>
  );
}
