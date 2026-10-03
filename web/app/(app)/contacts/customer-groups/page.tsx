import { RequirePermission } from "@/components/shared/Can";
import { CustomerGroupsPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="customer_group.view">
      <CustomerGroupsPage />
    </RequirePermission>
  );
}
