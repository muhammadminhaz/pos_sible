import { RequirePermission } from "@/components/shared/Can";
import { VariationsPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <VariationsPage />
    </RequirePermission>
  );
}
