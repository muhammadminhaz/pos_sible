import { RequirePermission } from "@/components/shared/Can";
import { PrintersPage } from "@/features/settings/configs";

export default function Page() {
  return (
    <RequirePermission permission="settings.printer">
      <PrintersPage />
    </RequirePermission>
  );
}
