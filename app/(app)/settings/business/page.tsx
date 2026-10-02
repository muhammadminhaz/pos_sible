import { RequirePermission } from "@/components/shared/Can";
import { BusinessSettings } from "@/features/settings/BusinessSettings";

export default function Page() {
  return (
    <RequirePermission permission="settings.business">
      <BusinessSettings />
    </RequirePermission>
  );
}
