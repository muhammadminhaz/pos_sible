import { RequirePermission } from "@/components/shared/Can";
import { TechniciansPage } from "@/features/catalog/configs";

export default function Page() {
  return (
    <RequirePermission permission="technician.view">
      <TechniciansPage />
    </RequirePermission>
  );
}
