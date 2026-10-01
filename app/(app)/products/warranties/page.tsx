import { RequirePermission } from "@/components/shared/Can";
import { WarrantiesPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <WarrantiesPage />
    </RequirePermission>
  );
}
