import { RequirePermission } from "@/components/shared/Can";
import { UsersPage } from "@/features/settings/configs";

export default function Page() {
  return (
    <RequirePermission permission="user.view">
      <UsersPage />
    </RequirePermission>
  );
}
