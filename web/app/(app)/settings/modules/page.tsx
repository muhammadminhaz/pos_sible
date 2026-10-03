import { RequirePermission } from "@/components/shared/Can";
import { ModulesPage } from "@/features/settings/ModulesPage";

export default function Page() {
  return (
    <RequirePermission permission="modules">
      <ModulesPage />
    </RequirePermission>
  );
}
