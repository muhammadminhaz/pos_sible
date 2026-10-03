import { RequirePermission } from "@/components/shared/Can";
import { TaxRatesPage } from "@/features/settings/configs";

export default function Page() {
  return (
    <RequirePermission permission="settings.tax">
      <TaxRatesPage />
    </RequirePermission>
  );
}
