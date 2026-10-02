import { RequirePermission } from "@/components/shared/Can";
import { BarcodesPage } from "@/features/settings/configs";

export default function Page() {
  return (
    <RequirePermission permission="settings.barcode">
      <BarcodesPage />
    </RequirePermission>
  );
}
