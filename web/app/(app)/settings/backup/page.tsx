import { RequirePermission } from "@/components/shared/Can";
import { BackupPage } from "@/features/settings/BackupPage";

export default function Page() {
  return (
    <RequirePermission permission="backup">
      <BackupPage />
    </RequirePermission>
  );
}
