import { RequirePermission } from "@/components/shared/Can";
import { CategoriesPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="product.view">
      <CategoriesPage />
    </RequirePermission>
  );
}
