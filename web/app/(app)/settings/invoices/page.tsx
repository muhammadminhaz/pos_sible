import { RequirePermission } from "@/components/shared/Can";
import { InvoicesPage } from "@/features/settings/configs";

export default function Page() {
  return (
    <RequirePermission permission="settings.invoice">
      <InvoicesPage />
    </RequirePermission>
  );
}
