import { RequirePermission } from "@/components/shared/Can";
import { Opportunities } from "@/features/growth/Opportunities";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Opportunities />
    </RequirePermission>
  );
}
