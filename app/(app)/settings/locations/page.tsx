import { RequirePermission } from "@/components/shared/Can";
import { LocationsPage } from "@/features/settings/configs";

export default function Page() {
  return (
    <RequirePermission permission="settings.location">
      <LocationsPage />
    </RequirePermission>
  );
}
