import { RequirePermission } from "@/components/shared/Can";
import { RolesPage } from "@/features/settings/RolesPage";

export default function Page() {
  return (
    <RequirePermission permission="role.view">
      <RolesPage />
    </RequirePermission>
  );
}
