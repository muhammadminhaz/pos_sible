import { RequirePermission } from "@/components/shared/Can";
import { UpdatePricePage } from "@/features/catalog/ImportPages";

export default function Page() {
  return (
    <RequirePermission permission="product.update">
      <UpdatePricePage />
    </RequirePermission>
  );
}
