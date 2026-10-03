import { RequirePermission } from "@/components/shared/Can";
import { Goals } from "@/features/possible/Goals";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Goals />
    </RequirePermission>
  );
}
